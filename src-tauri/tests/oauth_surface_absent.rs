use serde_json::Value;
use std::{fs, path::PathBuf};

fn manifest_file(relative_path: &str) -> String {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative_path);
    fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()))
}

#[test]
fn private_alpha_invoke_surface_exposes_only_approved_desktop_commands() {
    let source = manifest_file("src/lib.rs");
    let forbidden_commands = [
        "commands::auth::start_oauth_flow",
        "commands::auth::handle_oauth_callback",
        "commands::auth::get_auth_state",
        "commands::auth::refresh_auth_token",
        "commands::auth::logout",
        "commands::publish::publish_game",
        "commands::dashboard::fetch_game_stats",
    ];

    for command in forbidden_commands {
        assert!(
            !source.contains(command),
            "private-alpha runtime must not register {command}"
        );
    }

    let handler_start = source
        .find("tauri::generate_handler![")
        .expect("runtime must declare an invoke handler")
        + "tauri::generate_handler![".len();
    let handler_end = source[handler_start..]
        .find(']')
        .map(|offset| handler_start + offset)
        .expect("invoke handler must close its command list");
    let registered_commands: Vec<_> = source[handler_start..handler_end]
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .collect();

    let approved_commands = [
        "commands::project::create_project",
        "commands::project::get_project_state",
        "commands::project::write_file",
        "commands::project::read_file",
        "commands::ai::send_chat_message",
        "commands::ai::set_api_key",
        "commands::ai::check_api_key",
        "commands::build::build_project",
        "commands::validate::validate_project",
        "commands::validate::auto_fix_issue",
        "commands::rojo::check_rojo_status",
        "commands::rojo::start_rojo_serve",
        "commands::rojo::stop_rojo_serve",
        "roblox_authority::get_roblox_authority_state",
        "roblox_authority::set_roblox_api_key",
        "roblox_authority::delete_roblox_api_key",
        "roblox_authority::register_roblox_target",
        "roblox_authority::publish_roblox_project",
        "roblox_authority::query_owned_analytics",
    ];

    assert_eq!(registered_commands, approved_commands);
}

#[test]
fn private_alpha_runtime_initializes_no_legacy_roblox_authority_or_secrets() {
    let source = manifest_file("src/lib.rs");
    let forbidden_runtime_fragments = [
        "tauri_plugin_opener",
        "tauri_plugin_shell",
        "dotenvy",
        ".env",
        "OPENROUTER_API_KEY",
        "ANTHROPIC_API_KEY",
        "use state::AppState",
        "AppState::default()",
        ".manage(app_state)",
        "commands::auth",
        "commands::dashboard",
        "commands::publish::publish_game",
    ];

    for fragment in forbidden_runtime_fragments {
        assert!(
            !source.contains(fragment),
            "private-alpha runtime must not initialize legacy authority fragment {fragment:?}"
        );
    }
}

#[test]
fn legacy_roblox_modules_are_not_compiled() {
    let library = manifest_file("src/lib.rs");
    let command_modules = manifest_file("src/commands/mod.rs");

    assert!(!library.contains("mod roblox;"));
    for module in ["pub mod auth;", "pub mod dashboard;", "pub mod publish;"] {
        assert!(
            !command_modules.contains(module),
            "legacy module must not be compiled: {module}"
        );
    }
}

#[test]
fn private_alpha_runtime_retains_rojo_state_for_the_read_only_probe() {
    let source = manifest_file("src/lib.rs");

    assert!(
        source.contains("commands::rojo::RojoState::default()"),
        "read-only Rojo status probe requires RojoState"
    );
    assert!(
        source.contains(".manage(rojo_state)"),
        "read-only Rojo status probe requires managed RojoState"
    );
}

#[test]
fn default_capability_grants_no_shell_or_opener_permission() {
    let capability: Value = serde_json::from_str(&manifest_file("capabilities/default.json"))
        .expect("default capability must contain valid JSON");
    let permissions = capability
        .get("permissions")
        .and_then(Value::as_array)
        .expect("default capability must declare permissions");

    for permission in permissions {
        let identifier = permission
            .as_str()
            .or_else(|| permission.get("identifier").and_then(Value::as_str))
            .expect("capability permission must have an identifier");
        assert!(
            !identifier.starts_with("shell:") && !identifier.starts_with("opener:"),
            "default capability must not grant {identifier}"
        );
    }
}
