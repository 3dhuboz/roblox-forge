use crate::ai;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiChange {
    pub r#type: String,
    pub description: String,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiResponse {
    pub message: String,
    pub changes: Vec<AiChange>,
}

#[tauri::command]
pub async fn send_chat_message(
    project_path: String,
    message: String,
    history: Vec<ChatMessage>,
    user_level: Option<String>,
    user_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<AiResponse, String> {
    let api_key = state
        .api_key
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("API key not set. Go to Settings to add your Claude API key.")?;

    let level = user_level.as_deref().unwrap_or("beginner");
    let name = user_name.as_deref().unwrap_or("Builder");

    ai::process_message(&api_key, &project_path, &message, &history, level, name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_api_key(api_key: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut key = state.api_key.lock().map_err(|e| e.to_string())?;
    *key = Some(api_key);
    Ok(())
}
