mod ai;
mod builder;
mod commands;
mod project;
mod roblox;
mod state;
mod validation;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file from project root (one level up from src-tauri)
    let _ = dotenvy::from_path(
        std::env::current_dir()
            .unwrap_or_default()
            .join(".env"),
    );
    // Also try parent dir (when running from src-tauri)
    let _ = dotenvy::from_path(
        std::env::current_dir()
            .unwrap_or_default()
            .parent()
            .map(|p| p.join(".env"))
            .unwrap_or_default(),
    );

    // Pre-load API key from environment
    let app_state = AppState::default();
    let rojo_state = commands::rojo::RojoState::default();
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            *app_state.api_key.lock().unwrap() = Some(key);
            eprintln!("[RobloxForge] API key loaded from .env");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .manage(rojo_state)
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::get_project_state,
            commands::project::write_file,
            commands::ai::send_chat_message,
            commands::ai::set_api_key,
            commands::build::build_project,
            commands::auth::start_oauth_flow,
            commands::auth::handle_oauth_callback,
            commands::auth::get_auth_state,
            commands::auth::refresh_auth_token,
            commands::auth::logout,
            commands::publish::publish_game,
            commands::validate::validate_project,
            commands::validate::auto_fix_issue,
            commands::dashboard::fetch_game_stats,
            commands::rojo::check_rojo_status,
            commands::rojo::start_rojo_serve,
            commands::rojo::stop_rojo_serve,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
