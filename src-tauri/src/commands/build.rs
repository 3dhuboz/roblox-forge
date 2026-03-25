use crate::builder::rojo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildResult {
    pub rbxl_path: String,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub async fn build_project(project_path: String) -> Result<BuildResult, String> {
    rojo::build(&project_path).await.map_err(|e| e.to_string())
}
