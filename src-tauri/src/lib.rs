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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
