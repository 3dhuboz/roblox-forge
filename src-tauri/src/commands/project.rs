use crate::project::manager;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub template: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceNode {
    pub class_name: String,
    pub name: String,
    pub properties: serde_json::Value,
    pub children: Vec<InstanceNode>,
    pub tags: Option<Vec<String>>,
    pub script_source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptFile {
    pub relative_path: String,
    pub name: String,
    pub script_type: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectState {
    pub name: String,
    pub path: String,
    pub template: String,
    pub hierarchy: InstanceNode,
    pub scripts: Vec<ScriptFile>,
    pub stage_count: u32,
}

#[tauri::command]
pub async fn create_project(
    template_name: String,
    project_name: String,
    app_handle: tauri::AppHandle,
) -> Result<ProjectInfo, String> {
    manager::create_project(&template_name, &project_name, &app_handle)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project_state(project_path: String) -> Result<ProjectState, String> {
    manager::get_project_state(&project_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(
    project_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    manager::write_project_file(&project_path, &relative_path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_file(
    project_path: String,
    relative_path: String,
) -> Result<String, String> {
    manager::read_project_file(&project_path, &relative_path).map_err(|e| e.to_string())
}
