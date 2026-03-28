use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub id: String,
    pub severity: String,
    pub message: String,
    pub location: Option<String>,
    pub auto_fixable: bool,
    pub fix_description: Option<String>,
}

pub fn validate(project_path: &str) -> Vec<ValidationIssue> {
    let path = Path::new(project_path);
    let mut issues = Vec::new();

    check_project_json_valid(path, &mut issues);
    check_spawn_exists(path, &mut issues);
    check_stages_sequential(path, &mut issues);
    check_each_stage_has_checkpoint(path, &mut issues);
    check_config_valid(path, &mut issues);
    check_scripts_parse(path, &mut issues);
    check_no_parts_at_origin(path, &mut issues);
    check_total_part_count(path, &mut issues);

    issues
}

fn check_project_json_valid(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let project_json = path.join("default.project.json");
    if !project_json.exists() {
        issues.push(ValidationIssue {
            id: "project_json_missing".into(),
            severity: "error".into(),
            message: "default.project.json is missing".into(),
            location: Some("default.project.json".into()),
            auto_fixable: false,
            fix_description: None,
        });
        return;
    }

    match fs::read_to_string(&project_json) {
        Ok(content) => {
            if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                issues.push(ValidationIssue {
                    id: "project_json_invalid".into(),
                    severity: "error".into(),
                    message: "default.project.json is not valid JSON".into(),
                    location: Some("default.project.json".into()),
                    auto_fixable: false,
                    fix_description: None,
                });
            }
        }
        Err(_) => {
            issues.push(ValidationIssue {
                id: "project_json_unreadable".into(),
                severity: "error".into(),
                message: "Cannot read default.project.json".into(),
                location: Some("default.project.json".into()),
                auto_fixable: false,
                fix_description: None,
            });
        }
    }
}

fn check_spawn_exists(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let lobby_path = path.join("workspace").join("Lobby.model.json");
    if !lobby_path.exists() {
        issues.push(ValidationIssue {
            id: "no_lobby".into(),
            severity: "error".into(),
            message: "No Lobby found. Players need a spawn point.".into(),
            location: Some("workspace/Lobby.model.json".into()),
            auto_fixable: false,
            fix_description: None,
        });
        return;
    }

    if let Ok(content) = fs::read_to_string(&lobby_path) {
        let has_spawn = content.contains("SpawnLocation");
        if !has_spawn {
            issues.push(ValidationIssue {
                id: "no_spawn_in_lobby".into(),
                severity: "error".into(),
                message: "Lobby has no SpawnLocation. Players can't spawn!".into(),
                location: Some("workspace/Lobby.model.json".into()),
                auto_fixable: true,
                fix_description: Some("Add a SpawnLocation to the Lobby".into()),
            });
        }
    }
}

fn check_stages_sequential(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let stages_dir = path.join("workspace").join("Stages");
    if !stages_dir.exists() {
        return;
    }

    let mut stage_numbers: Vec<u32> = Vec::new();
    if let Ok(entries) = fs::read_dir(&stages_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Some(num_str) = name.strip_prefix("Stage").and_then(|s| s.strip_suffix(".model.json")) {
                if let Ok(num) = num_str.parse::<u32>() {
                    stage_numbers.push(num);
                }
            }
        }
    }

    stage_numbers.sort();

    for (i, &num) in stage_numbers.iter().enumerate() {
        let expected = (i + 1) as u32;
        if num != expected {
            issues.push(ValidationIssue {
                id: format!("stage_gap_{}", expected),
                severity: "error".into(),
                message: format!(
                    "Stage numbering gap: expected Stage{} but found Stage{}",
                    expected, num
                ),
                location: Some("workspace/Stages/".into()),
                auto_fixable: false,
                fix_description: None,
            });
            break;
        }
    }
}

fn check_each_stage_has_checkpoint(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let stages_dir = path.join("workspace").join("Stages");
    if !stages_dir.exists() {
        return;
    }

    if let Ok(entries) = fs::read_dir(&stages_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let fname = entry.file_name().to_string_lossy().to_string();
            if !fname.ends_with(".model.json") || !fname.starts_with("Stage") {
                continue;
            }

            if let Ok(content) = fs::read_to_string(entry.path()) {
                if !content.contains("SpawnLocation") {
                    let stage_name = fname.strip_suffix(".model.json").unwrap_or(&fname);
                    issues.push(ValidationIssue {
                        id: format!("no_checkpoint_{}", stage_name),
                        severity: "error".into(),
                        message: format!(
                            "{} has no checkpoint (SpawnLocation). Players can't save progress here.",
                            stage_name
                        ),
                        location: Some(format!("workspace/Stages/{}", fname)),
                        auto_fixable: true,
                        fix_description: Some("Ask AI to add a checkpoint to this stage".into()),
                    });
                }
            }
        }
    }
}

fn check_config_valid(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let shared_dir = path.join("src").join("shared");
    if !shared_dir.exists() {
        return;
    }

    // Find any *Config.luau file (works for all templates)
    let config_file = fs::read_dir(&shared_dir)
        .ok()
        .and_then(|entries| {
            entries
                .filter_map(|e| e.ok())
                .find(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    name.ends_with("Config.luau") && name != "RateLimit.luau"
                })
        });

    let config_entry = match config_file {
        Some(entry) => entry,
        None => {
            issues.push(ValidationIssue {
                id: "config_missing".into(),
                severity: "warning".into(),
                message: "No config module found in src/shared/".into(),
                location: Some("src/shared/".into()),
                auto_fixable: false,
                fix_description: None,
            });
            return;
        }
    };

    let config_path = config_entry.path();
    let config_name = config_entry.file_name().to_string_lossy().to_string();
    let relative = format!("src/shared/{}", config_name);

    if let Ok(content) = fs::read_to_string(&config_path) {
        // Check MaxStages matches actual count (obby-specific but harmless for others)
        if let Some(max_str) = content
            .lines()
            .find(|l| l.contains("MaxStages"))
            .and_then(|l| l.split('=').last())
            .map(|s| s.trim())
        {
            if let Ok(max_stages) = max_str.parse::<u32>() {
                let stages_dir = path.join("workspace").join("Stages");
                let actual = fs::read_dir(&stages_dir)
                    .map(|entries| {
                        entries
                            .filter_map(|e| e.ok())
                            .filter(|e| e.file_name().to_string_lossy().starts_with("Stage"))
                            .count() as u32
                    })
                    .unwrap_or(0);

                if actual > 0 && max_stages != actual {
                    issues.push(ValidationIssue {
                        id: "config_stage_mismatch".into(),
                        severity: "warning".into(),
                        message: format!(
                            "MaxStages is {} but there are {} actual stages",
                            max_stages, actual
                        ),
                        location: Some(relative.clone()),
                        auto_fixable: true,
                        fix_description: Some(format!("Update MaxStages to {}", actual)),
                    });
                }
            }
        }

        // Check config parses (balanced brackets)
        check_luau_balanced(&content, &config_path, path, issues);
    }
}

fn check_scripts_parse(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let src_dir = path.join("src");
    if !src_dir.exists() {
        return;
    }

    fn walk_scripts(dir: &Path, base: &Path, issues: &mut Vec<ValidationIssue>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let p = entry.path();
                if p.is_dir() {
                    walk_scripts(&p, base, issues);
                } else if p.extension().map_or(false, |e| e == "luau" || e == "lua") {
                    if let Ok(content) = fs::read_to_string(&p) {
                        let relative = p
                            .strip_prefix(base)
                            .unwrap_or(&p)
                            .to_string_lossy()
                            .replace('\\', "/");

                        // Run the real Luau linter
                        let lint_issues = crate::validation::luau_lint::lint_luau(&content, &p);
                        for li in lint_issues {
                            issues.push(ValidationIssue {
                                id: format!("luau_{}_{}", relative.replace('/', "_"), li.line),
                                severity: li.severity.into(),
                                message: format!("{}:{}: {}", relative, li.line, li.message),
                                location: Some(relative.clone()),
                                auto_fixable: false,
                                fix_description: None,
                            });
                        }
                    }
                }
            }
        }
    }

    walk_scripts(&src_dir, path, issues);
}

fn check_luau_balanced(
    content: &str,
    file_path: &Path,
    base: &Path,
    issues: &mut Vec<ValidationIssue>,
) {
    let relative = file_path
        .strip_prefix(base)
        .unwrap_or(file_path)
        .to_string_lossy()
        .replace('\\', "/");

    // Count block openers and closers
    let mut depth: i32 = 0;
    for line in content.lines() {
        let trimmed = line.trim();
        // Skip comments
        if trimmed.starts_with("--") {
            continue;
        }

        // Count openers: function, if/then, do, repeat
        for keyword in ["function ", "function(", "if ", "do\n", " do$", "repeat"] {
            if trimmed.contains(keyword)
                || trimmed == "do"
                || (trimmed.starts_with("for ") && trimmed.contains(" do"))
                || (trimmed.starts_with("while ") && trimmed.contains(" do"))
            {
                depth += 1;
                break;
            }
        }

        if trimmed == "end" || trimmed.starts_with("end)") || trimmed.starts_with("end,") {
            depth -= 1;
        }
        if trimmed == "until" || trimmed.starts_with("until ") {
            depth -= 1;
        }
    }

    if depth > 0 {
        issues.push(ValidationIssue {
            id: format!("script_missing_end_{}", relative),
            severity: "error".into(),
            message: format!("{}: Missing 'end' keyword ({} unclosed blocks)", relative, depth),
            location: Some(relative),
            auto_fixable: false,
            fix_description: None,
        });
    } else if depth < 0 {
        issues.push(ValidationIssue {
            id: format!("script_extra_end_{}", relative),
            severity: "error".into(),
            message: format!("{}: Extra 'end' keyword ({} extra)", relative, -depth),
            location: Some(relative),
            auto_fixable: false,
            fix_description: None,
        });
    }
}

fn check_no_parts_at_origin(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let stages_dir = path.join("workspace").join("Stages");
    if !stages_dir.exists() {
        return;
    }

    if let Ok(entries) = fs::read_dir(&stages_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if content.contains("\"position\": [0.0, 0.0, 0.0]")
                    || content.contains("\"position\":[0.0,0.0,0.0]")
                    || content.contains("\"position\": [0, 0, 0]")
                {
                    let fname = entry.file_name().to_string_lossy().to_string();
                    issues.push(ValidationIssue {
                        id: format!("part_at_origin_{}", fname),
                        severity: "warning".into(),
                        message: format!(
                            "{}: Part at origin [0,0,0] - probably unintentional",
                            fname
                        ),
                        location: Some(format!("workspace/Stages/{}", fname)),
                        auto_fixable: false,
                        fix_description: None,
                    });
                }
            }
        }
    }
}

fn check_total_part_count(path: &Path, issues: &mut Vec<ValidationIssue>) {
    let stages_dir = path.join("workspace").join("Stages");
    if !stages_dir.exists() {
        return;
    }

    let mut total_parts = 0;
    if let Ok(entries) = fs::read_dir(&stages_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                // Count "className" occurrences as a rough part count
                total_parts += content.matches("\"className\"").count();
            }
        }
    }

    if total_parts > 5000 {
        issues.push(ValidationIssue {
            id: "too_many_parts".into(),
            severity: "warning".into(),
            message: format!(
                "High part count (~{}). This may cause lag for players.",
                total_parts
            ),
            location: None,
            auto_fixable: false,
            fix_description: None,
        });
    }
}
