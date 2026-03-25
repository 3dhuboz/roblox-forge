use crate::roblox::oauth;
use crate::state::{AppState, AuthTokens};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthState2 {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
    pub user_id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

impl From<AuthTokens> for AuthState2 {
    fn from(tokens: AuthTokens) -> Self {
        Self {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at,
            user_id: tokens.user_id,
            username: tokens.username,
            display_name: tokens.display_name,
            avatar_url: tokens.avatar_url,
        }
    }
}

#[tauri::command]
pub async fn start_oauth_flow(state: State<'_, AppState>) -> Result<String, String> {
    oauth::start_flow(&state).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn handle_oauth_callback(
    code: String,
    callback_state: String,
    state: State<'_, AppState>,
) -> Result<AuthState2, String> {
    oauth::handle_callback(&code, &callback_state, &state)
        .await
        .map(|t| t.into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_auth_state(state: State<'_, AppState>) -> Result<Option<AuthState2>, String> {
    let auth = state.auth.lock().map_err(|e| e.to_string())?;
    Ok(auth.clone().map(|t| t.into()))
}

#[tauri::command]
pub async fn refresh_auth_token(state: State<'_, AppState>) -> Result<AuthState2, String> {
    oauth::refresh_token(&state)
        .await
        .map(|t| t.into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let mut auth = state.auth.lock().map_err(|e| e.to_string())?;
    *auth = None;
    Ok(())
}
