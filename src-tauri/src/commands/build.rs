use crate::builder::{rbx_builder, rojo};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildResult {
    pub rbxl_path: String,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub async fn build_project(project_path: String) -> Result<BuildResult, String> {
    let path = Path::new(&project_path);
    let build_dir = path.join("build");
    fs::create_dir_all(&build_dir).map_err(|e| format!("Cannot create build dir: {}", e))?;
    let output_path = build_dir.join("game.rbxl");

    // Try native rbx-dom builder first (no external dependencies)
    match rbx_builder::build_rbxl(&project_path) {
        Ok(rbxl_data) => {
            fs::write(&output_path, &rbxl_data)
                .map_err(|e| format!("Failed to write .rbxl: {}", e))?;

            Ok(BuildResult {
                rbxl_path: output_path.to_string_lossy().into(),
                warnings: vec!["Built with native rbx-dom engine.".into()],
            })
        }
        Err(native_err) => {
            // Fall back to external Rojo CLI if available
            eprintln!(
                "[Build] Native builder failed: {}. Trying Rojo CLI...",
                native_err
            );
            match rojo::build(&project_path).await {
                Ok(result) => {
                    let mut warnings = result.warnings;
                    warnings.insert(
                        0,
                        format!(
                            "Native builder failed ({}), used Rojo CLI instead.",
                            native_err
                        ),
                    );
                    Ok(BuildResult {
                        rbxl_path: result.rbxl_path,
                        warnings,
                    })
                }
                Err(rojo_err) => Err(format!(
                    "Build failed.\nNative: {}\nRojo: {}",
                    native_err, rojo_err
                )),
            }
        }
    }
}
