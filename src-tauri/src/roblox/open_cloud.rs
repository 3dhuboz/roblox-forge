use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::time::Duration;

const MAX_RETRIES: u32 = 3;

/// Send an HTTP request with retry logic for transient errors.
async fn request_with_retry(
    _client: &reqwest::Client,
    request_builder: impl Fn() -> reqwest::RequestBuilder,
) -> Result<reqwest::Response> {
    for attempt in 0..MAX_RETRIES {
        let response = request_builder().send().await;

        match response {
            Ok(resp) => {
                let status = resp.status().as_u16();
                // Retry on transient errors
                if matches!(status, 429 | 500 | 502 | 503) && attempt < MAX_RETRIES - 1 {
                    // Respect Retry-After header if present
                    let wait_secs = resp
                        .headers()
                        .get("retry-after")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|s| s.parse::<u64>().ok())
                        .unwrap_or(2u64.pow(attempt + 1));
                    eprintln!(
                        "[OpenCloud] {} response (attempt {}/{}), retrying in {}s",
                        status, attempt + 1, MAX_RETRIES, wait_secs
                    );
                    tokio::time::sleep(Duration::from_secs(wait_secs)).await;
                    continue;
                }
                return Ok(resp);
            }
            Err(e) if attempt < MAX_RETRIES - 1 => {
                let backoff = 2u64.pow(attempt + 1);
                eprintln!(
                    "[OpenCloud] Request failed (attempt {}/{}): {} — retrying in {}s",
                    attempt + 1, MAX_RETRIES, e, backoff
                );
                tokio::time::sleep(Duration::from_secs(backoff)).await;
            }
            Err(e) => return Err(e.into()),
        }
    }
    anyhow::bail!("Request failed after {} attempts", MAX_RETRIES)
}

/// Upload a .rbxl file to a Roblox place
pub async fn upload_place(
    access_token: &str,
    universe_id: &str,
    place_id: &str,
    rbxl_data: &[u8],
) -> Result<u32> {
    let client = reqwest::Client::new();
    let data = rbxl_data.to_vec();

    let url = format!(
        "https://apis.roblox.com/universes/v1/{}/places/{}/versions?versionType=Published",
        universe_id, place_id
    );

    let url_clone = url.clone();
    let token = access_token.to_string();
    let response = request_with_retry(&client, || {
        client
            .post(&url_clone)
            .bearer_auth(&token)
            .header("content-type", "application/octet-stream")
            .body(data.clone())
    })
    .await
    .context("Failed to upload place file")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Place upload failed ({}): {}", status, body);
    }

    let result: serde_json::Value = response.json().await?;
    let version = result["versionNumber"].as_u64().unwrap_or(0) as u32;

    Ok(version)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameStats {
    pub universe_id: String,
    pub name: String,
    pub playing: u64,
    pub visits: u64,
    pub favorites: u64,
    pub updated: String,
}

/// Fetch game statistics for all universes the user owns.
/// Uses Roblox Web APIs (not Open Cloud) since analytics aren't in Open Cloud yet.
pub async fn fetch_user_games(access_token: &str, user_id: &str) -> Result<Vec<GameStats>> {
    let client = reqwest::Client::new();

    // Get user's universes via the Open Cloud v2 API
    let url = format!(
        "https://apis.roblox.com/cloud/v2/users/{}/universes?maxPageSize=50",
        user_id
    );

    let response = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .context("Failed to fetch user universes")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        // If Open Cloud endpoint doesn't work, fall back to empty
        eprintln!("[Dashboard] Universe list failed ({}): {}", status, body);
        return Ok(Vec::new());
    }

    let result: serde_json::Value = response.json().await?;
    let universes = result["universes"].as_array();

    let mut stats = Vec::new();

    if let Some(universes) = universes {
        for universe in universes {
            let universe_id = universe["id"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let name = universe["displayName"]
                .as_str()
                .or_else(|| universe["name"].as_str())
                .unwrap_or("Unnamed Game")
                .to_string();

            // Fetch place-level stats from the public API
            let game_stat = fetch_single_game_stats(&client, &universe_id, &name).await;
            stats.push(game_stat);
        }
    }

    Ok(stats)
}

async fn fetch_single_game_stats(
    client: &reqwest::Client,
    universe_id: &str,
    name: &str,
) -> GameStats {
    // Use the public games API v1 for visit/player counts (doesn't require auth)
    let url = format!(
        "https://games.roblox.com/v1/games?universeIds={}",
        universe_id
    );

    let stats = match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                let data = &body["data"][0];
                GameStats {
                    universe_id: universe_id.to_string(),
                    name: data["name"].as_str().unwrap_or(name).to_string(),
                    playing: data["playing"].as_u64().unwrap_or(0),
                    visits: data["visits"].as_u64().unwrap_or(0),
                    favorites: data["favoritedCount"].as_u64().unwrap_or(0),
                    updated: data["updated"].as_str().unwrap_or("").to_string(),
                }
            } else {
                GameStats {
                    universe_id: universe_id.to_string(),
                    name: name.to_string(),
                    playing: 0,
                    visits: 0,
                    favorites: 0,
                    updated: String::new(),
                }
            }
        }
        _ => GameStats {
            universe_id: universe_id.to_string(),
            name: name.to_string(),
            playing: 0,
            visits: 0,
            favorites: 0,
            updated: String::new(),
        },
    };

    stats
}

/// Update place display name and description
pub async fn update_place_info(
    access_token: &str,
    universe_id: &str,
    place_id: &str,
    name: &str,
    description: &str,
) -> Result<()> {
    let client = reqwest::Client::new();

    let url = format!(
        "https://apis.roblox.com/cloud/v2/universes/{}/places/{}",
        universe_id, place_id
    );

    let body = serde_json::json!({
        "displayName": name,
        "description": description
    });

    let response = client
        .patch(&url)
        .bearer_auth(access_token)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .context("Failed to update place info")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Place info update failed ({}): {}", status, body);
    }

    Ok(())
}
