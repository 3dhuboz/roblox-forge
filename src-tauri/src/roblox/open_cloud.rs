use anyhow::{Context, Result};

/// Upload a .rbxl file to a Roblox place
pub async fn upload_place(
    access_token: &str,
    universe_id: &str,
    place_id: &str,
    rbxl_data: &[u8],
) -> Result<u32> {
    let client = reqwest::Client::new();

    let url = format!(
        "https://apis.roblox.com/universes/v1/{}/places/{}/versions?versionType=Published",
        universe_id, place_id
    );

    let response = client
        .post(&url)
        .bearer_auth(access_token)
        .header("content-type", "application/octet-stream")
        .body(rbxl_data.to_vec())
        .send()
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
        "description": description,
        "serverSize": 50
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
