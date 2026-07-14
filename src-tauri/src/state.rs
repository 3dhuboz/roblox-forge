use std::sync::{Arc, Mutex};

#[derive(Default, Clone)]
pub struct AiSettingsState {
    pub api_key: Arc<Mutex<Option<String>>>,
}
