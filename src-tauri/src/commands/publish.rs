use crate::builder::rojo;
use crate::roblox::open_cloud;
use crate::state::AppState;
use crate::validation::checks;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct PublishResult {
    pub success: bool,
    pub version_number: Option<u32>,
    pub game_url: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn publish_game(
    project_path: String,
    game_name: String,
    game_description: String,
    universe_id: String,
    place_id: String,
    state: State<'_, AppState>,
) -> Result<PublishResult, String> {
    // Step 1: Build
    let build_result = rojo::build(&project_path)
        .await
        .map_err(|e| format!("Build failed: {}", e))?;

    // Step 2: Validate
    let issues = checks::validate(&project_path);
    let has_errors = issues.iter().any(|i| i.severity == "error");
    if has_errors {
        return Ok(PublishResult {
            success: false,
            version_number: None,
            game_url: None,
            error: Some("Validation failed with errors. Fix issues before publishing.".into()),
        });
    }

    // Step 3: Get auth token
    let auth = state
        .auth
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Not authenticated. Connect your Roblox account first.")?;

    // Step 4: Upload place file
    let rbxl_data = std::fs::read(&build_result.rbxl_path)
        .map_err(|e| format!("Failed to read .rbxl file: {}", e))?;

    let version = open_cloud::upload_place(
        &auth.access_token,
        &universe_id,
        &place_id,
        &rbxl_data,
    )
    .await
    .map_err(|e| format!("Upload failed: {}", e))?;

    // Step 5: Update place info
    open_cloud::update_place_info(
        &auth.access_token,
        &universe_id,
        &place_id,
        &game_name,
        &game_description,
    )
    .await
    .map_err(|e| format!("Failed to update game info: {}", e))?;

    Ok(PublishResult {
        success: true,
        version_number: Some(version),
        game_url: Some(format!("https://www.roblox.com/games/{}", universe_id)),
        error: None,
    })
}
