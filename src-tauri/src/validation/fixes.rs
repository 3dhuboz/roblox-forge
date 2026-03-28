use anyhow::{anyhow, Result};
use std::fs;
use std::path::Path;

/// Apply an auto-fix for a known validation issue.
/// Returns a human-readable description of what was fixed.
pub fn apply_fix(project_path: &str, issue_id: &str) -> Result<String> {
    let path = Path::new(project_path);

    match issue_id {
        "no_spawn_in_lobby" => fix_missing_lobby_spawn(path),

        id if id.starts_with("no_checkpoint_Stage") => {
            let stage_name = id.strip_prefix("no_checkpoint_").unwrap_or("Stage1");
            fix_missing_stage_checkpoint(path, stage_name)
        }

        "config_stage_mismatch" => fix_config_stage_count(path),

        _ => Err(anyhow!("No auto-fix available for issue '{}'", issue_id)),
    }
}

/// Add a SpawnLocation to an existing Lobby that lacks one.
fn fix_missing_lobby_spawn(project_path: &Path) -> Result<String> {
    let lobby_path = project_path.join("workspace").join("Lobby.model.json");
    let content = fs::read_to_string(&lobby_path)?;

    let mut doc: serde_json::Value = serde_json::from_str(&content)?;

    let spawn = serde_json::json!({
        "className": "SpawnLocation",
        "properties": {
            "Name": { "String": "LobbySpawn" },
            "Size": { "Vector3": [20.0, 1.0, 20.0] },
            "CFrame": { "CFrame": { "position": [0.0, 0.5, 0.0], "orientation": [0, 0, 0, 1, 0, 0, 0, 1, 0] } },
            "Color3uint8": { "Color3uint8": [100, 200, 100] },
            "Material": { "Enum": 256 },
            "Anchored": { "Bool": true },
            "Neutral": { "Bool": true }
        }
    });

    if let Some(children) = doc.get_mut("children") {
        if let Some(arr) = children.as_array_mut() {
            arr.insert(0, spawn);
        }
    } else {
        doc["children"] = serde_json::json!([spawn]);
    }

    let output = serde_json::to_string_pretty(&doc)?;
    fs::write(&lobby_path, output)?;

    Ok("Added a SpawnLocation to the Lobby so players can spawn.".into())
}

/// Add a SpawnLocation checkpoint to a stage model file.
fn fix_missing_stage_checkpoint(project_path: &Path, stage_name: &str) -> Result<String> {
    let stage_file = format!("{}.model.json", stage_name);
    let stage_path = project_path
        .join("workspace")
        .join("Stages")
        .join(&stage_file);

    if !stage_path.exists() {
        return Err(anyhow!("Stage file not found: {}", stage_file));
    }

    let content = fs::read_to_string(&stage_path)?;
    let mut doc: serde_json::Value = serde_json::from_str(&content)?;

    // Extract a stage number for positioning the checkpoint offset
    let stage_num: f64 = stage_name
        .strip_prefix("Stage")
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(1.0);

    let x_offset = stage_num * 60.0;

    let checkpoint = serde_json::json!({
        "className": "SpawnLocation",
        "properties": {
            "Name": { "String": format!("{}Checkpoint", stage_name) },
            "Size": { "Vector3": [8.0, 1.0, 8.0] },
            "CFrame": { "CFrame": { "position": [x_offset, 0.5, 0.0], "orientation": [0, 0, 0, 1, 0, 0, 0, 1, 0] } },
            "Color3uint8": { "Color3uint8": [80, 200, 255] },
            "Material": { "Enum": 288 },
            "Anchored": { "Bool": true },
            "AllowTeamChangeOnTouch": { "Bool": false }
        }
    });

    if let Some(children) = doc.get_mut("children") {
        if let Some(arr) = children.as_array_mut() {
            arr.push(checkpoint);
        }
    } else {
        doc["children"] = serde_json::json!([checkpoint]);
    }

    let output = serde_json::to_string_pretty(&doc)?;
    fs::write(&stage_path, output)?;

    Ok(format!(
        "Added a checkpoint (SpawnLocation) to {}. Players can now save progress here!",
        stage_name
    ))
}

/// Update ObbyConfig.MaxStages to match the actual stage count on disk.
fn fix_config_stage_count(project_path: &Path) -> Result<String> {
    let config_path = project_path
        .join("src")
        .join("shared")
        .join("ObbyConfig.luau");

    if !config_path.exists() {
        return Err(anyhow!("ObbyConfig.luau not found"));
    }

    // Count actual stages
    let stages_dir = project_path.join("workspace").join("Stages");
    let actual_count = fs::read_dir(&stages_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    name.starts_with("Stage") && name.ends_with(".model.json")
                })
                .count()
        })
        .unwrap_or(0);

    let content = fs::read_to_string(&config_path)?;
    let mut updated_lines: Vec<String> = Vec::new();
    let mut fixed = false;

    for line in content.lines() {
        if line.contains("ObbyConfig.MaxStages") && line.contains('=') {
            updated_lines.push(format!("ObbyConfig.MaxStages = {}", actual_count));
            fixed = true;
        } else {
            updated_lines.push(line.to_string());
        }
    }

    if !fixed {
        return Err(anyhow!(
            "Could not find ObbyConfig.MaxStages line in config"
        ));
    }

    fs::write(&config_path, updated_lines.join("\n"))?;

    Ok(format!(
        "Updated ObbyConfig.MaxStages to {} to match the actual stage count.",
        actual_count
    ))
}
