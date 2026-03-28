use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiMessage {
    pub role: String,
    pub content: String,
}

// ── OpenRouter (OpenAI-compatible) request/response types ──

#[derive(Debug, Serialize)]
struct OpenRouterRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ApiMessage>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterMessage,
}

#[derive(Debug, Deserialize)]
struct OpenRouterMessage {
    content: Option<String>,
}

// ── Anthropic direct API types ──

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ApiMessage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicBlock>,
}

#[derive(Debug, Deserialize)]
struct AnthropicBlock {
    text: Option<String>,
}

/// Detect whether the key is for OpenRouter or Anthropic and route accordingly.
pub async fn send_message(
    api_key: &str,
    system_prompt: &str,
    messages: &[ApiMessage],
) -> Result<String> {
    if api_key.starts_with("sk-or-") {
        send_openrouter(api_key, system_prompt, messages).await
    } else {
        send_anthropic(api_key, system_prompt, messages).await
    }
}

async fn send_openrouter(
    api_key: &str,
    system_prompt: &str,
    messages: &[ApiMessage],
) -> Result<String> {
    let client = reqwest::Client::new();

    // Prepend system prompt as a system message
    let mut all_messages = vec![ApiMessage {
        role: "system".into(),
        content: system_prompt.into(),
    }];
    all_messages.extend_from_slice(messages);

    let request = OpenRouterRequest {
        model: "anthropic/claude-sonnet-4-20250514".into(),
        max_tokens: 4096,
        messages: all_messages,
    };

    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://robloxforge.app")
        .header("X-Title", "RobloxForge")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .context("Failed to call OpenRouter API")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("OpenRouter API error ({}): {}", status, body);
    }

    let api_response: OpenRouterResponse = response
        .json()
        .await
        .context("Failed to parse OpenRouter response")?;

    let text = api_response
        .choices
        .into_iter()
        .filter_map(|c| c.message.content)
        .collect::<Vec<_>>()
        .join("");

    Ok(text)
}

async fn send_anthropic(
    api_key: &str,
    system_prompt: &str,
    messages: &[ApiMessage],
) -> Result<String> {
    let client = reqwest::Client::new();

    let request = AnthropicRequest {
        model: "claude-sonnet-4-20250514".into(),
        max_tokens: 4096,
        system: system_prompt.into(),
        messages: messages.to_vec(),
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .context("Failed to call Claude API")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Claude API error ({}): {}", status, body);
    }

    let api_response: AnthropicResponse = response
        .json()
        .await
        .context("Failed to parse API response")?;

    let text = api_response
        .content
        .into_iter()
        .filter_map(|b| b.text)
        .collect::<Vec<_>>()
        .join("");

    Ok(text)
}
