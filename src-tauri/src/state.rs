use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Default, Clone)]
pub struct AppState {
    pub api_key: Arc<Mutex<Option<String>>>,
    pub auth: Arc<Mutex<Option<AuthTokens>>>,
    pub oauth_state: Arc<Mutex<Option<OAuthPending>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
    pub user_id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct OAuthPending {
    pub code_verifier: String,
    pub state: String,
}
