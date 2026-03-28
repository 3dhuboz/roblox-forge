use crate::roblox::open_cloud::{self, GameStats};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn fetch_game_stats(state: State<'_, AppState>) -> Result<Vec<GameStats>, String> {
    let auth = state.auth.lock().unwrap().clone();
    let tokens = auth.ok_or("Not authenticated. Log in to Roblox first.")?;

    open_cloud::fetch_user_games(&tokens.access_token, &tokens.user_id)
        .await
        .map_err(|e| e.to_string())
}
