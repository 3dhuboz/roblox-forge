use crate::builder::{rojo, rojo_serve::RojoServeProcess};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

pub struct RojoState {
    pub serve_process: Mutex<Option<RojoServeProcess>>,
}

impl Default for RojoState {
    fn default() -> Self {
        Self {
            serve_process: Mutex::new(None),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RojoStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub serving: bool,
    pub serve_port: Option<u16>,
    pub install_instructions: Option<String>,
}

#[tauri::command]
pub async fn check_rojo_status(state: State<'_, RojoState>) -> Result<RojoStatus, String> {
    let installed = rojo::find_rojo_binary().is_some();

    let version = if installed {
        std::process::Command::new(rojo::find_rojo_binary().unwrap())
            .arg("--version")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    } else {
        None
    };

    let mut serve = state.serve_process.lock().unwrap();
    let serving = serve.as_mut().map_or(false, |p| p.is_running());
    let serve_port = if serving {
        serve.as_ref().map(|p| p.port())
    } else {
        None
    };

    Ok(RojoStatus {
        installed,
        version,
        serving,
        serve_port,
        install_instructions: if !installed {
            Some("Install Rojo with: cargo install rojo\nOr with Rokit: rokit add rojo-rbx/rojo".into())
        } else {
            None
        },
    })
}

#[tauri::command]
pub async fn start_rojo_serve(
    project_path: String,
    state: State<'_, RojoState>,
) -> Result<u16, String> {
    let port = 34872;

    // Stop existing process if any
    let mut serve = state.serve_process.lock().unwrap();
    if let Some(mut existing) = serve.take() {
        let _ = existing.stop();
    }

    let process = RojoServeProcess::start(&project_path, port)
        .map_err(|e| e.to_string())?;

    let actual_port = process.port();
    *serve = Some(process);

    Ok(actual_port)
}

#[tauri::command]
pub async fn stop_rojo_serve(state: State<'_, RojoState>) -> Result<(), String> {
    let mut serve = state.serve_process.lock().unwrap();
    if let Some(mut process) = serve.take() {
        process.stop().map_err(|e| e.to_string())?;
    }
    Ok(())
}
