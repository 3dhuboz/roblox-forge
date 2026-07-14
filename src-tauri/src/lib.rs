mod ai;
mod builder;
mod commands;
pub mod platform;
mod project;
mod roblox;
mod state;
mod validation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let rojo_state = commands::rojo::RojoState::default();

    tauri::Builder::default()
        .manage(rojo_state)
        .invoke_handler(tauri::generate_handler![commands::rojo::check_rojo_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
