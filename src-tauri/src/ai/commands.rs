use crate::commands::ai::AiChange;
use anyhow::Result;
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
            if let Ok(parsed) = serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
                commands = parsed;
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

/// Apply parsed commands to the project files on disk
pub fn apply_commands(
    project_path: &str,
    commands: &[serde_json::Value],
) -> Result<Vec<AiChange>> {
    let mut changes = Vec::new();
    let path = Path::new(project_path);

    for cmd in commands {
        let cmd_type = cmd
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        match cmd_type {
            "add_stage" => {
                let change = apply_add_stage(path, cmd)?;
                changes.push(change);
            }
            "modify_script" => {
                let change = apply_modify_script(path, cmd)?;
                changes.push(change);
            }
            "update_config" => {
                let change = apply_update_config(path, cmd)?;
                changes.push(change);
            }
            "add_part" => {
                let change = apply_add_part(path, cmd)?;
                changes.push(change);
            }
            "remove_part" => {
                let change = apply_remove_part(path, cmd)?;
                changes.push(change);
            }
            _ => {
                changes.push(AiChange {
                    r#type: cmd_type.into(),
                    description: format!("Unknown command: {}", cmd_type),
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
    update_max_stages(project_path)?;

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

    let full_path = project_path.join(script_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&full_path, content)?;

    Ok(AiChange {
        r#type: "modify_script".into(),
        description: format!("Updated {}", script_path),
        path: Some(script_path.into()),
    })
}

fn apply_update_config(project_path: &Path, cmd: &serde_json::Value) -> Result<AiChange> {
    let changes = cmd.get("changes").cloned().unwrap_or(serde_json::json!({}));
    let config_path = project_path.join("src").join("shared").join("ObbyConfig.luau");
    let mut content = fs::read_to_string(&config_path).unwrap_or_default();

    if let Some(obj) = changes.as_object() {
        for (key, value) in obj {
            // Simple pattern-based replacement in the Luau config
            let search = format!("ObbyConfig.{} = ", key);
            if let Some(pos) = content.find(&search) {
                let line_end = content[pos..].find('\n').unwrap_or(content.len() - pos);
                let new_line = format!("ObbyConfig.{} = {}", key, lua_value(value));
                content.replace_range(pos..pos + line_end, &new_line);
            }
        }
    }

    fs::write(&config_path, &content)?;

    Ok(AiChange {
        r#type: "update_config".into(),
        description: "Updated game config".into(),
        path: Some("src/shared/ObbyConfig.luau".into()),
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

    if model_path.exists() {
        let content = fs::read_to_string(&model_path)?;
        let mut model: serde_json::Value = serde_json::from_str(&content)?;
        if let Some(children) = model.get_mut("children").and_then(|c| c.as_array_mut()) {
            children.push(part);
        }
        fs::write(&model_path, serde_json::to_string_pretty(&model)?)?;
    }

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

    if model_path.exists() {
        let content = fs::read_to_string(&model_path)?;
        let mut model: serde_json::Value = serde_json::from_str(&content)?;
        if let Some(children) = model.get_mut("children").and_then(|c| c.as_array_mut()) {
            children.retain(|child| {
                let name = child
                    .get("properties")
                    .and_then(|p| p.get("Name"))
                    .and_then(|n| n.get("String"))
                    .and_then(|s| s.as_str())
                    .unwrap_or("");
                name != part_name
            });
        }
        fs::write(&model_path, serde_json::to_string_pretty(&model)?)?;
    }

    Ok(AiChange {
        r#type: "remove_part".into(),
        description: format!("Removed {} from {}", part_name, stage),
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
        let mut content = fs::read_to_string(&config_path)?;
        let search = "ObbyConfig.MaxStages = ";
        if let Some(pos) = content.find(search) {
            let line_end = content[pos..].find('\n').unwrap_or(content.len() - pos);
            let new_line = format!("ObbyConfig.MaxStages = {}", count);
            content.replace_range(pos..pos + line_end, &new_line);
            fs::write(&config_path, content)?;
        }
    }

    Ok(())
}

fn lua_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => format!("\"{}\"", s),
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
