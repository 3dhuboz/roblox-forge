use super::checks::ValidationIssue;
use std::path::Path;
use std::process::Command;

/// Find the selene binary on PATH or in common install locations.
pub fn find_selene() -> Option<String> {
    // Check PATH
    if Command::new("selene")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some("selene".into());
    }

    // Check common install locations
    let home = dirs::home_dir()?;
    let candidates = [
        home.join(".aftman").join("bin").join("selene.exe"),
        home.join(".aftman").join("bin").join("selene"),
        home.join(".foreman").join("bin").join("selene.exe"),
        home.join(".foreman").join("bin").join("selene"),
        home.join(".cargo").join("bin").join("selene.exe"),
        home.join(".cargo").join("bin").join("selene"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into());
        }
    }

    None
}

/// Run selene on the project's src/ directory and return validation issues.
pub fn run_selene(project_path: &Path) -> Vec<ValidationIssue> {
    let src_dir = project_path.join("src");
    if !src_dir.exists() {
        return Vec::new();
    }

    let binary = match find_selene() {
        Some(b) => b,
        None => return Vec::new(), // Selene not installed — skip silently
    };

    let output = match Command::new(&binary)
        .arg("--display-style")
        .arg("json2")
        .arg(src_dir.to_string_lossy().as_ref())
        .output()
    {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_selene_json(&stdout, project_path)
}

/// Parse selene JSON2 output into ValidationIssue structs.
fn parse_selene_json(output: &str, base_path: &Path) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parsed: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let diagnostics = match parsed.get("diagnostics").and_then(|d| d.as_array()) {
            Some(arr) => arr,
            None => continue,
        };

        for diag in diagnostics {
            let severity = diag
                .get("severity")
                .and_then(|s| s.as_str())
                .unwrap_or("warning");
            let message = diag
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown selene issue");
            let code = diag
                .get("code")
                .and_then(|c| c.as_str())
                .unwrap_or("selene");

            let filename = parsed
                .get("filename")
                .and_then(|f| f.as_str())
                .unwrap_or("");

            let line_num = diag
                .get("primary_label")
                .and_then(|l| l.get("span"))
                .and_then(|s| s.get("start_line"))
                .and_then(|n| n.as_u64())
                .unwrap_or(0);

            let relative = Path::new(filename)
                .strip_prefix(base_path)
                .unwrap_or(Path::new(filename))
                .to_string_lossy()
                .replace('\\', "/");

            issues.push(ValidationIssue {
                id: format!("selene_{}_{}", code, issues.len()),
                severity: match severity {
                    "error" => "error".into(),
                    "warning" => "warning".into(),
                    _ => "info".into(),
                },
                message: format!("[selene/{}] {}:{}: {}", code, relative, line_num, message),
                location: Some(relative),
                auto_fixable: false,
                fix_description: None,
            });
        }
    }

    issues
}
