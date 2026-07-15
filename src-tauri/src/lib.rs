mod ai;
mod builder;
mod commands;
pub mod intelligence;
pub mod platform;
mod project;
pub mod roblox_authority;
mod state;
mod validation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let rojo_state = commands::rojo::RojoState::default();
    let ai_settings_state = state::AiSettingsState::default();
    let roblox_authority = roblox_authority::RobloxAuthority::production()
        .expect("Roblox desktop authority could not be initialized");

    tauri::Builder::default()
        .manage(rojo_state)
        .manage(ai_settings_state)
        .manage(roblox_authority)
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::get_project_state,
            commands::project::write_file,
            commands::project::read_file,
            commands::ai::send_chat_message,
            commands::ai::set_api_key,
            commands::ai::check_api_key,
            commands::build::build_project,
            commands::validate::validate_project,
            commands::validate::auto_fix_issue,
            commands::rojo::check_rojo_status,
            commands::rojo::start_rojo_serve,
            commands::rojo::stop_rojo_serve,
            roblox_authority::get_roblox_authority_state,
            roblox_authority::set_roblox_api_key,
            roblox_authority::delete_roblox_api_key,
            roblox_authority::register_roblox_target,
            roblox_authority::publish_roblox_project,
            roblox_authority::query_owned_analytics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
