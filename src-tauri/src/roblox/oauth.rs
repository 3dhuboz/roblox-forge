use crate::state::{AppState, AuthTokens, OAuthPending};
use anyhow::{Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

// Replace with your actual Roblox OAuth client ID
const CLIENT_ID: &str = "YOUR_ROBLOX_CLIENT_ID";
const REDIRECT_PORT: u16 = 23847;
const REDIRECT_URI: &str = "http://localhost:23847/callback";

fn generate_code_verifier() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn generate_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn generate_state() -> String {
    let mut bytes = [0u8; 16];
    rand::rng().fill_bytes(&mut bytes);
    hex::encode(&bytes)
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}

pub async fn start_flow(state: &State<'_, AppState>) -> Result<String> {
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);
    let oauth_state = generate_state();

    // Store pending state
    {
        let mut pending = state.oauth_state.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        *pending = Some(OAuthPending {
            code_verifier: code_verifier.clone(),
            state: oauth_state.clone(),
        });
    }

    let auth_url = format!(
        "https://apis.roblox.com/oauth/v1/authorize?\
        client_id={}&\
        redirect_uri={}&\
        scope=openid+profile+universe.place:write&\
        response_type=code&\
        code_challenge={}&\
        code_challenge_method=S256&\
        state={}",
        CLIENT_ID,
        urlencoding::encode(REDIRECT_URI),
        code_challenge,
        oauth_state
    );

    // Open in system browser
    let _ = open::that(&auth_url);

    // Start listening for callback in background
    let state_clone = state.inner().clone();
    tokio::spawn(async move {
        if let Err(e) = listen_for_callback(state_clone).await {
            eprintln!("OAuth callback error: {}", e);
        }
    });

    Ok(auth_url)
}

async fn listen_for_callback(state: AppState) -> Result<()> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", REDIRECT_PORT))
        .context("Failed to bind OAuth callback port")?;

    // Set a timeout so we don't block forever
    listener
        .set_nonblocking(false)
        .context("Failed to set blocking")?;

    let (stream, _) = listener.accept().context("No callback received")?;
    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    // Parse the GET request for code and state params
    let (code, callback_state) = parse_callback_params(&request_line)?;

    // Send success response to browser
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
        <html><body style=\"font-family:sans-serif;text-align:center;padding:60px;background:#1a1a2e;color:white\">\
        <h1>Connected!</h1><p>You can close this tab and return to RobloxForge.</p>\
        </body></html>";
    let mut stream_write = stream.try_clone()?;
    stream_write.write_all(response.as_bytes())?;

    // Verify state
    let pending = state
        .oauth_state
        .lock()
        .map_err(|e| anyhow::anyhow!("{}", e))?
        .clone()
        .context("No pending OAuth flow")?;

    if callback_state != pending.state {
        anyhow::bail!("OAuth state mismatch");
    }

    // Exchange code for tokens
    let tokens = exchange_code(&code, &pending.code_verifier).await?;

    // Store tokens
    let mut auth = state.auth.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
    *auth = Some(tokens);

    Ok(())
}

fn parse_callback_params(request_line: &str) -> Result<(String, String)> {
    let path = request_line
        .split_whitespace()
        .nth(1)
        .context("Invalid request")?;

    let url = url::Url::parse(&format!("http://localhost{}", path))?;
    let code = url
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .context("No code in callback")?;
    let state = url
        .query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.to_string())
        .context("No state in callback")?;

    Ok((code, state))
}

async fn exchange_code(code: &str, code_verifier: &str) -> Result<AuthTokens> {
    let client = reqwest::Client::new();

    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("client_id", CLIENT_ID),
        ("code_verifier", code_verifier),
        ("redirect_uri", REDIRECT_URI),
    ];

    let response = client
        .post("https://apis.roblox.com/oauth/v1/token")
        .form(&params)
        .send()
        .await
        .context("Token exchange request failed")?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Token exchange failed: {}", body);
    }

    let token_response: serde_json::Value = response.json().await?;

    let access_token = token_response["access_token"]
        .as_str()
        .context("No access_token")?
        .to_string();
    let refresh_token = token_response["refresh_token"]
        .as_str()
        .context("No refresh_token")?
        .to_string();
    let expires_in = token_response["expires_in"].as_u64().unwrap_or(899);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Get user info
    let user_info = get_user_info(&access_token).await?;

    Ok(AuthTokens {
        access_token,
        refresh_token,
        expires_at: now + expires_in,
        user_id: user_info.0,
        username: user_info.1,
        display_name: user_info.2,
        avatar_url: user_info.3,
    })
}

async fn get_user_info(access_token: &str) -> Result<(String, String, String, Option<String>)> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://apis.roblox.com/oauth/v1/userinfo")
        .bearer_auth(access_token)
        .send()
        .await?;

    let info: serde_json::Value = response.json().await?;

    Ok((
        info["sub"].as_str().unwrap_or("").to_string(),
        info["preferred_username"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        info["name"].as_str().unwrap_or("").to_string(),
        info["picture"].as_str().map(String::from),
    ))
}

pub async fn handle_callback(
    code: &str,
    callback_state: &str,
    state: &State<'_, AppState>,
) -> Result<AuthTokens> {
    let pending = state
        .oauth_state
        .lock()
        .map_err(|e| anyhow::anyhow!("{}", e))?
        .clone()
        .context("No pending OAuth flow")?;

    if callback_state != pending.state {
        anyhow::bail!("OAuth state mismatch");
    }

    let tokens = exchange_code(code, &pending.code_verifier).await?;

    let mut auth = state.auth.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
    *auth = Some(tokens.clone());

    Ok(tokens)
}

pub async fn refresh_token(state: &State<'_, AppState>) -> Result<AuthTokens> {
    let current = state
        .auth
        .lock()
        .map_err(|e| anyhow::anyhow!("{}", e))?
        .clone()
        .context("Not authenticated")?;

    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", &current.refresh_token),
        ("client_id", CLIENT_ID),
    ];

    let response = client
        .post("https://apis.roblox.com/oauth/v1/token")
        .form(&params)
        .send()
        .await?;

    if !response.status().is_success() {
        anyhow::bail!("Token refresh failed");
    }

    let token_response: serde_json::Value = response.json().await?;
    let access_token = token_response["access_token"]
        .as_str()
        .context("No access_token")?
        .to_string();
    let refresh_tok = token_response["refresh_token"]
        .as_str()
        .unwrap_or(&current.refresh_token)
        .to_string();
    let expires_in = token_response["expires_in"].as_u64().unwrap_or(899);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let tokens = AuthTokens {
        access_token,
        refresh_token: refresh_tok,
        expires_at: now + expires_in,
        ..current
    };

    let mut auth = state.auth.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
    *auth = Some(tokens.clone());

    Ok(tokens)
}
