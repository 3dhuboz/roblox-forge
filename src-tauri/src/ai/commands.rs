use crate::commands::ai::AiChange;
use anyhow::{anyhow, Context, Result};
use std::fs;
use std::path::Path;

/// Parse the AI response into display text and raw JSON commands
pub fn parse_response(response: &str) -> (String, Vec<serde_json::Value>) {
    let mut display_text = String::new();
    let mut commands = Vec::new();

    // Find JSON code block
    let json_start = response.find("```json");
    let json_end = response.rfind("```");

    if let (Some(start), Some(end)) = (json_start, json_end) {
        if end > start {
            // Everything before the JSON block is display text
            display_text = response[..start].trim().to_string();

            // Extract JSON
            let json_str = &response[start + 7..end].trim();
            match serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
                Ok(parsed) => commands = parsed,
                Err(e) => {
                    // Try parsing as a single object and wrap in array
                    if let Ok(single) = serde_json::from_str::<serde_json::Value>(json_str) {
                        commands = vec![single];
                    } else {
                        eprintln!("[AI] Failed to parse command JSON: {}", e);
                        if display_text.is_empty() {
                            display_text = response.to_string();
                        }
                    }
                }
            }

            // Anything after the closing ``` is also display text
            let after = response[end + 3..].trim();
            if !after.is_empty() {
                if !display_text.is_empty() {
                    display_text.push_str("\n\n");
                }
                display_text.push_str(after);
            }
        }
    } else {
        display_text = response.to_string();
    }

    if display_text.is_empty() {
        display_text = "Done!".into();
    }

    (display_text, commands)
}

/// Validate a command has required fields before applying it.
fn validate_command(cmd: &serde_json::Value) -> Result<&str> {
    let cmd_type = cmd
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Command missing 'type' field"))?;

    match cmd_type {
        "add_stage" => {
            cmd.get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("add_stage: missing 'name' field"))?;
        }
        "modify_script" => {
            let path = cmd.get("path").and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("modify_script: missing 'path' field"))?;
            cmd.get("content").and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("modify_script: missing 'content' for {}", path))?;
        }
        "update_config" => {
            let changes = cmd.get("changes")
                .ok_or_else(|| anyhow!("update_config: missing 'changes' field"))?;
            if !changes.is_object() {
                return Err(anyhow!("update_config: 'changes' must be an object"));
            }
        }
        "add_part" => {
            cmd.get("stage").and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("add_part: missing 'stage' field"))?;
            let part = cmd.get("part")
                .ok_or_else(|| anyhow!("add_part: missing 'part' field"))?;
            if !part.is_object() {
                return Err(anyhow!("add_part: 'part' must be an object"));
            }
            // Validate part has className
            part.get("className")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("add_part: part missing 'className'"))?;
        }
        "remove_part" => {
            cmd.get("stage").and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("remove_part: missing 'stage' field"))?;
            cmd.get("part_name").and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("remove_part: missing 'part_name' field"))?;
        }
        _ => {} // Unknown commands pass through
    }

    Ok(cmd_type)
}

/// Apply parsed commands to the project files on disk
pub fn apply_commands(
    project_path: &str,
    commands: &[serde_json::Value],
) -> Result<Vec<AiChange>> {
    let mut changes = Vec::new();
    let path = Path::new(project_path);

    for (i, cmd) in commands.iter().enumerate() {
        let cmd_type = match validate_command(cmd) {
            Ok(t) => t,
            Err(e) => {
                changes.push(AiChange {
                    r#type: "error".into(),
                    description: format!("Command #{}: {}", i + 1, e),
                    path: None,
                });
                continue;
            }
        };

        let result = match cmd_type {
            "add_stage" => apply_add_stage(path, cmd),
            "modify_script" => apply_modify_script(path, cmd),
            "update_config" => apply_update_config(path, cmd),
            "add_part" => apply_add_part(path, cmd),
            "remove_part" => apply_remove_part(path, cmd),
            _ => {
                changes.push(AiChange {
                    r#type: cmd_type.into(),
                    description: format!("Unknown command: {}", cmd_type),
                    path: None,
                });
                continue;
            }
        };

        match result {
            Ok(change) => changes.push(change),
            Err(e) => {
                changes.push(AiChange {
                    r#type: "error".into(),
                    description: format!("Failed to apply {}: {}", cmd_type, e),
                    path: None,
                });
            }
        }
    }

    Ok(changes)
}

fn apply_add_stage(project_path: &Path, cmd: &serde_json::Value) -> Result<AiChange> {
    let stage_name = cmd
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Stage");

    let stages_dir = project_path.join("workspace").join("Stages");
    fs::create_dir_all(&stages_dir)?;

    let parts = cmd.get("parts").cloned().unwrap_or(serde_json::json!([]));
    let checkpoint = cmd.get("checkpoint").cloned();

    let mut children: Vec<serde_json::Value> = if let Some(arr) = parts.as_array() {
        arr.clone()
    } else {
        vec![]
    };

    if let Some(cp) = checkpoint {
        children.push(cp);
    }

    let model = serde_json::json!({
        "className": "Folder",
        "children": children
    });

    let file_path = stages_dir.join(format!("{}.model.json", stage_name));
    fs::write(&file_path, serde_json::to_string_pretty(&model)?)?;

    // Update config MaxStages
    let _ = update_max_stages(project_path);

    Ok(AiChange {
        r#type: "add_stage".into(),
        description: format!("Added {}", stage_name),
        path: Some(format!("workspace/Stages/{}.model.json", stage_name)),
    })
}

fn apply_modify_script(project_path: &Path, cmd: &serde_json::Value) -> Result<AiChange> {
    let script_path = cmd
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let content = cmd
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Prevent path traversal
    if script_path.contains("..") {
        return Err(anyhow!("Path traversal not allowed: {}", script_path));
    }

    let full_path = project_path.join(script_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&full_path, content)
        .with_context(|| format!("Failed to write script: {}", script_path))?;

    Ok(AiChange {
        r#type: "modify_script".into(),
        description: format!("Updated {}", script_path),
        path: Some(script_path.into()),
    })
}

fn apply_update_config(project_path: &Path, cmd: &serde_json::Value) -> Result<AiChange> {
    let changes = cmd.get("changes").cloned().unwrap_or(serde_json::json!({}));

    // Try template-specific config files in order
    let config_candidates = [
        "src/shared/ObbyConfig.luau",
        "src/shared/TycoonConfig.luau",
        "src/shared/SimulatorConfig.luau",
        "src/shared/GameConfig.luau",
    ];

    let config_path = cmd
        .get("config_file")
        .and_then(|v| v.as_str())
        .map(|p| project_path.join(p))
        .or_else(|| {
            config_candidates
                .iter()
                .map(|c| project_path.join(c))
                .find(|p| p.exists())
        })
        .ok_or_else(|| anyhow!("No config file found"))?;

    let content = fs::read_to_string(&config_path)
        .with_context(|| format!("Cannot read config: {}", config_path.display()))?;

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let mut applied = Vec::new();

    if let Some(obj) = changes.as_object() {
        for (key, value) in obj {
            let lua_val = lua_value(value);
            let mut found = false;

            for line in &mut lines {
                let trimmed = line.trim();
                // Match patterns like: Config.Key = value  or  Key = value
                // Handle both "Config.Key = ..." and standalone "Key = ..."
                let patterns = [
                    format!(".{} =", key),
                    format!(".{}\t=", key),
                ];

                let is_match = patterns.iter().any(|p| trimmed.contains(p.as_str()))
                    || (trimmed.starts_with(key.as_str()) && trimmed.contains('='));

                if is_match && !trimmed.starts_with("--") {
                    // Preserve the prefix (indentation + config name) up to and including '='
                    if let Some(eq_pos) = line.find('=') {
                        let prefix = &line[..=eq_pos];
                        *line = format!("{} {}", prefix, lua_val);
                        found = true;
                        break;
                    }
                }
            }

            if found {
                applied.push(format!("{} = {}", key, lua_val));
            }
        }
    }

    let output = lines.join("\n");
    fs::write(&config_path, output)?;

    let desc = if applied.is_empty() {
        "Updated game config (no matching keys found)".into()
    } else {
        format!("Updated config: {}", applied.join(", "))
    };

    let relative = config_path
        .strip_prefix(project_path)
        .unwrap_or(&config_path)
        .to_string_lossy()
        .replace('\\', "/");

    Ok(AiChange {
        r#type: "update_config".into(),
        description: desc,
        path: Some(relative),
    })
}

fn apply_add_part(project_path: &Path, cmd: &serde_json::Value) -> Result<AiChange> {
    let stage = cmd
        .get("stage")
        .and_then(|v| v.as_str())
        .unwrap_or("Stage1");
    let part = cmd.get("part").cloned().unwrap_or(serde_json::json!({}));

    let model_path = project_path
        .join("workspace")
        .join("Stages")
        .join(format!("{}.model.json", stage));

    if !model_path.exists() {
        return Err(anyhow!("Stage file not found: {}", stage));
    }

    let content = fs::read_to_string(&model_path)?;
    let mut model: serde_json::Value = serde_json::from_str(&content)
        .with_context(|| format!("Invalid JSON in {}.model.json", stage))?;

    if let Some(children) = model.get_mut("children").and_then(|c| c.as_array_mut()) {
        children.push(part);
    } else {
        model["children"] = serde_json::json!([part]);
    }

    fs::write(&model_path, serde_json::to_string_pretty(&model)?)?;

    let part_name = cmd
        .get("part")
        .and_then(|p| p.get("properties"))
        .and_then(|p| p.get("Name"))
        .and_then(|n| n.get("String"))
        .and_then(|s| s.as_str())
        .unwrap_or("part");

    Ok(AiChange {
        r#type: "add_part".into(),
        description: format!("Added {} to {}", part_name, stage),
        path: Some(format!("workspace/Stages/{}.model.json", stage)),
    })
}

fn apply_remove_part(project_path: &Path, cmd: &serde_json::Value) -> Result<AiChange> {
    let stage = cmd
        .get("stage")
        .and_then(|v| v.as_str())
        .unwrap_or("Stage1");
    let part_name = cmd
        .get("part_name")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let model_path = project_path
        .join("workspace")
        .join("Stages")
        .join(format!("{}.model.json", stage));

    if !model_path.exists() {
        return Err(anyhow!("Stage file not found: {}", stage));
    }

    let content = fs::read_to_string(&model_path)?;
    let mut model: serde_json::Value = serde_json::from_str(&content)?;
    let mut removed = false;

    if let Some(children) = model.get_mut("children").and_then(|c| c.as_array_mut()) {
        let before_count = children.len();
        children.retain(|child| {
            let name = child
                .get("properties")
                .and_then(|p| p.get("Name"))
                .and_then(|n| n.get("String"))
                .and_then(|s| s.as_str())
                .unwrap_or("");
            name != part_name
        });
        removed = children.len() < before_count;
    }

    fs::write(&model_path, serde_json::to_string_pretty(&model)?)?;

    let desc = if removed {
        format!("Removed {} from {}", part_name, stage)
    } else {
        format!("Part '{}' not found in {}", part_name, stage)
    };

    Ok(AiChange {
        r#type: "remove_part".into(),
        description: desc,
        path: Some(format!("workspace/Stages/{}.model.json", stage)),
    })
}

fn update_max_stages(project_path: &Path) -> Result<()> {
    let stages_dir = project_path.join("workspace").join("Stages");
    let count = fs::read_dir(&stages_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().starts_with("Stage"))
        .count();

    let config_path = project_path.join("src").join("shared").join("ObbyConfig.luau");
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)?;
        let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

        for line in &mut lines {
            if line.contains("MaxStages") && line.contains('=') {
                if let Some(eq_pos) = line.find('=') {
                    let prefix = &line[..=eq_pos];
                    *line = format!("{} {}", prefix, count);
                    break;
                }
            }
        }

        fs::write(&config_path, lines.join("\n"))?;
    }

    Ok(())
}

fn lua_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"")),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Object(obj) => {
            let entries: Vec<String> = obj
                .iter()
                .map(|(k, v)| {
                    if k.parse::<u64>().is_ok() {
                        format!("\t[{}] = {}", k, lua_value(v))
                    } else {
                        format!("\t{} = {}", k, lua_value(v))
                    }
                })
                .collect();
            format!("{{\n{}\n}}", entries.join(",\n"))
        }
        serde_json::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(lua_value).collect();
            format!("{{{}}}", items.join(", "))
        }
        _ => "nil".into(),
    }
}
