use crate::commands::build::BuildResult;
use anyhow::{Context, Result};
use std::path::Path;
use std::process::Command;

pub async fn build(project_path: &str) -> Result<BuildResult> {
    let path = Path::new(project_path);
    let project_json = path.join("default.project.json");
    let output_path = path.join("build").join("game.rbxl");

    // Ensure build directory exists
    std::fs::create_dir_all(path.join("build"))?;

    // Try to find rojo binary
    let rojo_bin = find_rojo().context(
        "Rojo not found. Please install Rojo (https://rojo.space) and ensure it's in your PATH.",
    )?;

    let output = Command::new(&rojo_bin)
        .arg("build")
        .arg(project_json.to_string_lossy().as_ref())
        .arg("-o")
        .arg(output_path.to_string_lossy().as_ref())
        .current_dir(path)
        .output()
        .context("Failed to execute rojo build")?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        anyhow::bail!("Rojo build failed:\n{}\n{}", stdout, stderr);
    }

    // Collect warnings from stderr
    let warnings: Vec<String> = stderr
        .lines()
        .filter(|l| l.contains("warn") || l.contains("WARN"))
        .map(String::from)
        .collect();

    Ok(BuildResult {
        rbxl_path: output_path.to_string_lossy().into(),
        warnings,
    })
}

pub fn find_rojo_binary() -> Option<String> {
    find_rojo()
}

fn find_rojo() -> Option<String> {
    // Check PATH
    if Command::new("rojo").arg("--version").output().is_ok() {
        return Some("rojo".into());
    }

    // Check common install locations
    let home = dirs::home_dir()?;
    let candidates = [
        home.join(".aftman").join("bin").join("rojo.exe"),
        home.join(".aftman").join("bin").join("rojo"),
        home.join(".foreman").join("bin").join("rojo.exe"),
        home.join(".foreman").join("bin").join("rojo"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into());
        }
    }

    None
}
