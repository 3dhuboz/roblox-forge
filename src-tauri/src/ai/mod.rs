mod client;
mod commands;
mod prompt;

use crate::commands::ai::{AiResponse, ChatMessage};
use anyhow::Result;

pub async fn process_message(
    api_key: &str,
    project_path: &str,
    message: &str,
    history: &[ChatMessage],
    user_level: &str,
    user_name: &str,
) -> Result<AiResponse> {
    // Build system prompt with current project state and user level
    let system_prompt = prompt::build_system_prompt(project_path, user_level, user_name)?;

    // Convert history to API format
    let api_messages = prompt::build_messages(history, message);

    // Call Claude API
    let response_text = client::send_message(api_key, &system_prompt, &api_messages).await?;

    // Parse response: extract conversational text and JSON commands
    let (display_text, raw_commands) = commands::parse_response(&response_text);

    // Apply commands to project files
    let changes = commands::apply_commands(project_path, &raw_commands)?;

    Ok(AiResponse {
        message: display_text,
        changes,
    })
}
