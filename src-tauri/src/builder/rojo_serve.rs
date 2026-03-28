use anyhow::{Context, Result};
use std::path::Path;
use std::process::{Child, Command, Stdio};

/// Manages a `rojo serve` subprocess for live Studio sync.
pub struct RojoServeProcess {
    child: Child,
    port: u16,
}

impl RojoServeProcess {
    /// Start `rojo serve` in the given project directory.
    /// Returns None if Rojo is not installed.
    pub fn start(project_path: &str, port: u16) -> Result<Self> {
        let path = Path::new(project_path);
        let project_json = path.join("default.project.json");

        if !project_json.exists() {
            anyhow::bail!("No default.project.json found in {}", project_path);
        }

        let rojo_bin = super::rojo::find_rojo_binary()
            .context("Rojo not found. Install with: cargo install rojo")?;

        let child = Command::new(&rojo_bin)
            .arg("serve")
            .arg(project_json.to_string_lossy().as_ref())
            .arg("--port")
            .arg(port.to_string())
            .current_dir(path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to start rojo serve")?;

        Ok(Self { child, port })
    }

    /// Get the port the server is running on.
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Check if the serve process is still running.
    pub fn is_running(&mut self) -> bool {
        self.child.try_wait().ok().flatten().is_none()
    }

    /// Stop the serve process.
    pub fn stop(&mut self) -> Result<()> {
        self.child.kill().context("Failed to stop rojo serve")?;
        self.child.wait()?;
        Ok(())
    }
}

impl Drop for RojoServeProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}
