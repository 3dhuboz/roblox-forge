use crate::commands::project::{InstanceNode, ProjectInfo, ProjectState, ScriptFile};
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

fn get_projects_dir() -> Result<PathBuf> {
    let data_dir = dirs::data_dir()
        .context("Could not find data directory")?
        .join("RobloxForge")
        .join("projects");
    fs::create_dir_all(&data_dir)?;
    Ok(data_dir)
}

fn get_templates_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .context("Could not find resource directory")?;
    Ok(resource_dir.join("templates"))
}

pub fn create_project(
    template_name: &str,
    project_name: &str,
    app_handle: &tauri::AppHandle,
) -> Result<ProjectInfo> {
    let projects_dir = get_projects_dir()?;
    let project_dir = projects_dir.join(sanitize_name(project_name));

    if project_dir.exists() {
        anyhow::bail!("A project with this name already exists");
    }

    // Try resource dir first (bundled app), then several dev-mode fallbacks
    let template_source = get_templates_dir(app_handle)
        .map(|d| d.join(template_name))
        .ok()
        .filter(|p| p.exists())
        .or_else(|| {
            // CARGO_MANIFEST_DIR points to src-tauri/ at compile time
            let from_manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()?
                .join("templates")
                .join(template_name);
            if from_manifest.exists() { return Some(from_manifest); }
            // CWD-based fallback (npm run tauri dev runs from project root)
            let from_cwd = std::env::current_dir().ok()?.join("templates").join(template_name);
            if from_cwd.exists() { return Some(from_cwd); }
            // One level up from CWD (if CWD is src-tauri)
            let from_parent = std::env::current_dir().ok()?.parent()?.join("templates").join(template_name);
            if from_parent.exists() { return Some(from_parent.to_path_buf()); }
            None
        })
        .context(format!(
            "Template '{}' not found. Searched resource dir, CARGO_MANIFEST_DIR, and CWD.",
            template_name
        ))?;

    // Copy template to project dir
    let options = fs_extra::dir::CopyOptions::new();
    fs::create_dir_all(&project_dir)?;
    fs_extra::dir::copy(&template_source, &project_dir, &options)
        .context("Failed to copy template")?;

    // The copy puts files in project_dir/template_name, move them up
    let nested = project_dir.join(template_name);
    if nested.exists() {
        for entry in fs::read_dir(&nested)? {
            let entry = entry?;
            let dest = project_dir.join(entry.file_name());
            fs::rename(entry.path(), dest)?;
        }
        fs::remove_dir(&nested)?;
    }

    // Update project name in default.project.json
    let project_json_path = project_dir.join("default.project.json");
    if project_json_path.exists() {
        let content = fs::read_to_string(&project_json_path)?;
        let mut json: serde_json::Value = serde_json::from_str(&content)?;
        if let Some(obj) = json.as_object_mut() {
            obj.insert("name".into(), serde_json::Value::String(project_name.into()));
        }
        fs::write(&project_json_path, serde_json::to_string_pretty(&json)?)?;
    }

    Ok(ProjectInfo {
        name: project_name.into(),
        path: project_dir.to_string_lossy().into(),
        template: template_name.into(),
        created_at: chrono_now(),
    })
}

pub fn get_project_state(project_path: &str) -> Result<ProjectState> {
    let path = Path::new(project_path);

    // Read project json
    let project_json_path = path.join("default.project.json");
    let project_json: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&project_json_path)?)?;

    let name = project_json
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    // Build hierarchy from workspace model files
    let hierarchy = build_hierarchy(path, &project_json)?;

    // Collect scripts
    let scripts = collect_scripts(path)?;

    // Count stages
    let stages_dir = path.join("workspace").join("Stages");
    let stage_count = if stages_dir.exists() {
        fs::read_dir(&stages_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("Stage")
            })
            .count() as u32
    } else {
        0
    };

    Ok(ProjectState {
        name,
        path: project_path.into(),
        template: detect_template(path),
        hierarchy,
        scripts,
        stage_count,
    })
}

pub fn write_project_file(project_path: &str, relative_path: &str, content: &str) -> Result<()> {
    let full_path = Path::new(project_path).join(relative_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&full_path, content)?;
    Ok(())
}

fn build_hierarchy(project_path: &Path, project_json: &serde_json::Value) -> Result<InstanceNode> {
    let tree = project_json
        .get("tree")
        .context("No tree in project.json")?;

    fn parse_tree_node(
        node: &serde_json::Value,
        name: &str,
        project_path: &Path,
    ) -> InstanceNode {
        let class_name = node
            .get("$className")
            .and_then(|v| v.as_str())
            .unwrap_or("Folder")
            .to_string();

        let mut children = Vec::new();

        // Check for $path — load from file system
        if let Some(path_val) = node.get("$path").and_then(|v| v.as_str()) {
            let full_path = project_path.join(path_val);
            if full_path.is_file() {
                if path_val.ends_with(".model.json") {
                    if let Ok(content) = fs::read_to_string(&full_path) {
                        if let Ok(model) = serde_json::from_str::<serde_json::Value>(&content) {
                            return parse_model_json(&model, name);
                        }
                    }
                } else if path_val.ends_with(".luau") || path_val.ends_with(".lua") {
                    let script_type = if path_val.contains(".server.") {
                        "Script"
                    } else if path_val.contains(".client.") {
                        "LocalScript"
                    } else {
                        "ModuleScript"
                    };
                    let source = fs::read_to_string(&full_path).unwrap_or_default();
                    return InstanceNode {
                        class_name: script_type.into(),
                        name: name.into(),
                        properties: serde_json::json!({}),
                        children: vec![],
                        tags: None,
                        script_source: Some(source),
                    };
                }
            } else if full_path.is_dir() {
                // Directory — each entry is a child (recursive)
                children = parse_directory_children(&full_path);
                return InstanceNode {
                    class_name: "Folder".into(),
                    name: name.into(),
                    properties: serde_json::json!({}),
                    children,
                    tags: None,
                    script_source: None,
                };
            }
        }

        // Parse inline children from project.json
        if let Some(obj) = node.as_object() {
            for (key, value) in obj {
                if key.starts_with('$') {
                    continue;
                }
                children.push(parse_tree_node(value, key, project_path));
            }
        }

        InstanceNode {
            class_name,
            name: name.into(),
            properties: serde_json::json!({}),
            children,
            tags: None,
            script_source: None,
        }
    }

    Ok(parse_tree_node(tree, "DataModel", project_path))
}

/// Recursively parse all files and subdirectories into InstanceNode children.
fn parse_directory_children(dir: &Path) -> Vec<InstanceNode> {
    let mut children = Vec::new();

    let Ok(entries) = fs::read_dir(dir) else {
        return children;
    };

    let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let fname = entry.file_name().to_string_lossy().to_string();
        let child_path = entry.path();

        let child_name = fname
            .strip_suffix(".model.json")
            .or_else(|| fname.strip_suffix(".server.luau"))
            .or_else(|| fname.strip_suffix(".client.luau"))
            .or_else(|| fname.strip_suffix(".luau"))
            .or_else(|| fname.strip_suffix(".lua"))
            .unwrap_or(&fname)
            .to_string();

        if child_path.is_dir() {
            // Subdirectory becomes a Folder with recursive children
            children.push(InstanceNode {
                class_name: "Folder".into(),
                name: child_name,
                properties: serde_json::json!({}),
                children: parse_directory_children(&child_path),
                tags: None,
                script_source: None,
            });
        } else if fname.ends_with(".model.json") {
            if let Ok(content) = fs::read_to_string(&child_path) {
                if let Ok(model) = serde_json::from_str::<serde_json::Value>(&content) {
                    children.push(parse_model_json(&model, &child_name));
                }
            }
        } else if fname.ends_with(".luau") || fname.ends_with(".lua") {
            let st = if fname.contains(".server.") {
                "Script"
            } else if fname.contains(".client.") {
                "LocalScript"
            } else {
                "ModuleScript"
            };
            children.push(InstanceNode {
                class_name: st.into(),
                name: child_name,
                properties: serde_json::json!({}),
                children: vec![],
                tags: None,
                script_source: None,
            });
        }
    }

    children
}

/// Detect the template type from the project's config files.
fn detect_template(project_path: &Path) -> String {
    let shared_dir = project_path.join("src").join("shared");
    if !shared_dir.exists() {
        return "obby".into();
    }

    let config_map = [
        ("ObbyConfig", "obby"),
        ("TycoonConfig", "tycoon"),
        ("SimConfig", "simulator"),
        ("RPGConfig", "rpg"),
        ("RaceConfig", "racing"),
        ("HorrorConfig", "horror"),
        ("MiniConfig", "minigames"),
        ("BattleConfig", "battlegrounds"),
    ];

    if let Ok(entries) = fs::read_dir(&shared_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let fname = entry.file_name().to_string_lossy().to_string();
            for (prefix, template) in &config_map {
                if fname.starts_with(prefix) {
                    return template.to_string();
                }
            }
        }
    }

    "obby".into()
}

fn parse_model_json(model: &serde_json::Value, name: &str) -> InstanceNode {
    let class_name = model
        .get("className")
        .and_then(|v| v.as_str())
        .unwrap_or("Folder")
        .to_string();

    let properties = model
        .get("properties")
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let display_name = properties
        .get("Name")
        .and_then(|v| v.get("String"))
        .and_then(|v| v.as_str())
        .unwrap_or(name)
        .to_string();

    let tags = model
        .get("properties")
        .and_then(|p| p.get("Tags"))
        .and_then(|t| t.get("Tags"))
        .and_then(|t| t.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        });

    let children = model
        .get("children")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .enumerate()
                .map(|(i, child)| {
                    let fallback = format!("Child{}", i);
                    let child_name = child
                        .get("properties")
                        .and_then(|p| p.get("Name"))
                        .and_then(|n| n.get("String"))
                        .and_then(|s| s.as_str())
                        .unwrap_or(&fallback);
                    parse_model_json(child, child_name)
                })
                .collect()
        })
        .unwrap_or_default();

    InstanceNode {
        class_name,
        name: display_name,
        properties,
        children,
        tags,
        script_source: None,
    }
}

fn collect_scripts(project_path: &Path) -> Result<Vec<ScriptFile>> {
    let mut scripts = Vec::new();
    let src_dir = project_path.join("src");
    if !src_dir.exists() {
        return Ok(scripts);
    }

    fn walk(dir: &Path, base: &Path, scripts: &mut Vec<ScriptFile>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    walk(&path, base, scripts);
                } else if path.extension().map_or(false, |e| e == "luau" || e == "lua") {
                    let relative = path.strip_prefix(base).unwrap_or(&path);
                    let fname = path.file_name().unwrap_or_default().to_string_lossy();
                    let script_type = if fname.contains(".server.") {
                        "server"
                    } else if fname.contains(".client.") {
                        "client"
                    } else {
                        "module"
                    };
                    let name = fname
                        .strip_suffix(".server.luau")
                        .or_else(|| fname.strip_suffix(".client.luau"))
                        .or_else(|| fname.strip_suffix(".luau"))
                        .unwrap_or(&fname)
                        .to_string();

                    scripts.push(ScriptFile {
                        relative_path: relative.to_string_lossy().replace('\\', "/"),
                        name,
                        script_type: script_type.into(),
                        content: fs::read_to_string(&path).unwrap_or_default(),
                    });
                }
            }
        }
    }

    walk(&src_dir, project_path, &mut scripts);
    Ok(scripts)
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", secs)
}
