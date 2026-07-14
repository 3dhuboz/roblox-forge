use super::{AuthorityError, CredentialPurpose, VerifiedRobloxTarget};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use zeroize::Zeroizing;

const CREDENTIAL_SERVICE: &str = "au.com.3dhub.roblox-forge";

pub struct SecretValue(Zeroizing<String>);

impl SecretValue {
    pub fn new(value: String) -> Self {
        Self(Zeroizing::new(value))
    }

    pub(crate) fn expose(&self) -> &str {
        self.0.as_str()
    }
}

pub trait CredentialVault: Send + Sync {
    fn get(&self, alias: &str) -> Result<Option<SecretValue>, AuthorityError>;
    fn set(&self, alias: &str, secret: &str) -> Result<(), AuthorityError>;
    fn delete(&self, alias: &str) -> Result<(), AuthorityError>;
}

#[cfg(windows)]
pub struct WindowsCredentialVault;

#[cfg(windows)]
impl WindowsCredentialVault {
    fn entry(alias: &str) -> Result<keyring::Entry, AuthorityError> {
        keyring::Entry::new(CREDENTIAL_SERVICE, alias)
            .map_err(|_| AuthorityError::CredentialStoreUnavailable)
    }
}

#[cfg(windows)]
impl CredentialVault for WindowsCredentialVault {
    fn get(&self, alias: &str) -> Result<Option<SecretValue>, AuthorityError> {
        let entry = Self::entry(alias)?;
        match entry.get_password() {
            Ok(secret) => Ok(Some(SecretValue::new(secret))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(AuthorityError::CredentialStoreUnavailable),
        }
    }

    fn set(&self, alias: &str, secret: &str) -> Result<(), AuthorityError> {
        Self::entry(alias)?
            .set_password(secret)
            .map_err(|_| AuthorityError::CredentialStoreUnavailable)
    }

    fn delete(&self, alias: &str) -> Result<(), AuthorityError> {
        let entry = Self::entry(alias)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(AuthorityError::CredentialStoreUnavailable),
        }
    }
}

#[cfg(not(windows))]
pub struct WindowsCredentialVault;

#[cfg(not(windows))]
impl CredentialVault for WindowsCredentialVault {
    fn get(&self, _alias: &str) -> Result<Option<SecretValue>, AuthorityError> {
        Err(AuthorityError::CredentialStoreUnavailable)
    }

    fn set(&self, _alias: &str, _secret: &str) -> Result<(), AuthorityError> {
        Err(AuthorityError::CredentialStoreUnavailable)
    }

    fn delete(&self, _alias: &str) -> Result<(), AuthorityError> {
        Err(AuthorityError::CredentialStoreUnavailable)
    }
}

pub fn default_credential_vault() -> Arc<dyn CredentialVault> {
    Arc::new(WindowsCredentialVault)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CredentialMetadata {
    pub purpose: CredentialPurpose,
    pub alias: String,
    pub verified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryDocument {
    pub schema_version: u32,
    #[serde(default)]
    pub credential_metadata: Vec<CredentialMetadata>,
    #[serde(default)]
    pub targets: Vec<VerifiedRobloxTarget>,
}

impl Default for RegistryDocument {
    fn default() -> Self {
        Self {
            schema_version: 1,
            credential_metadata: Vec::new(),
            targets: Vec::new(),
        }
    }
}

pub struct RegistryStore {
    path: PathBuf,
    gate: Mutex<()>,
}

impl RegistryStore {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            gate: Mutex::new(()),
        }
    }

    pub fn production() -> Result<Self, AuthorityError> {
        let base = dirs::data_local_dir().ok_or(AuthorityError::RegistryUnavailable)?;
        Ok(Self::new(
            base.join("RobloxForge").join("roblox-authority.v1.json"),
        ))
    }

    pub fn load(&self) -> Result<RegistryDocument, AuthorityError> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| AuthorityError::RegistryUnavailable)?;
        self.load_unlocked()
    }

    pub fn save(&self, document: &RegistryDocument) -> Result<(), AuthorityError> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| AuthorityError::RegistryUnavailable)?;
        self.save_unlocked(document)
    }

    pub fn find_target(&self, target_id: &str) -> Result<VerifiedRobloxTarget, AuthorityError> {
        self.load()?
            .targets
            .into_iter()
            .find(|target| target.id == target_id)
            .ok_or(AuthorityError::TargetNotFound)
    }

    pub fn add_target(&self, target: VerifiedRobloxTarget) -> Result<(), AuthorityError> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| AuthorityError::RegistryUnavailable)?;
        let mut document = self.load_unlocked()?;
        if document.targets.iter().any(|existing| {
            existing.universe_id == target.universe_id
                && existing.root_place_id == target.root_place_id
        }) {
            return Err(AuthorityError::RobloxRejected);
        }
        document.targets.push(target);
        self.save_unlocked(&document)
    }

    pub fn set_credential_metadata(
        &self,
        metadata: CredentialMetadata,
    ) -> Result<(), AuthorityError> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| AuthorityError::RegistryUnavailable)?;
        let mut document = self.load_unlocked()?;
        document
            .credential_metadata
            .retain(|existing| existing.purpose != metadata.purpose);
        document.credential_metadata.push(metadata);
        self.save_unlocked(&document)
    }

    pub fn clear_credential_metadata(
        &self,
        purpose: CredentialPurpose,
    ) -> Result<(), AuthorityError> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| AuthorityError::RegistryUnavailable)?;
        let mut document = self.load_unlocked()?;
        document
            .credential_metadata
            .retain(|existing| existing.purpose != purpose);
        self.save_unlocked(&document)
    }

    fn load_unlocked(&self) -> Result<RegistryDocument, AuthorityError> {
        if !self.path.exists() {
            return Ok(RegistryDocument::default());
        }
        reject_symlink(&self.path)?;
        let bytes = fs::read(&self.path).map_err(|_| AuthorityError::RegistryUnavailable)?;
        if bytes.len() > 1_048_576 {
            return Err(AuthorityError::RegistryUnavailable);
        }
        let document: RegistryDocument =
            serde_json::from_slice(&bytes).map_err(|_| AuthorityError::RegistryUnavailable)?;
        if document.schema_version != 1 {
            return Err(AuthorityError::RegistryUnavailable);
        }
        Ok(document)
    }

    fn save_unlocked(&self, document: &RegistryDocument) -> Result<(), AuthorityError> {
        if document.schema_version != 1 {
            return Err(AuthorityError::RegistryUnavailable);
        }
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|_| AuthorityError::RegistryUnavailable)?;
            reject_symlink(parent)?;
        }
        if self.path.exists() {
            reject_symlink(&self.path)?;
        }
        let serialized =
            serde_json::to_vec_pretty(document).map_err(|_| AuthorityError::RegistryUnavailable)?;
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&self.path)
            .map_err(|_| AuthorityError::RegistryUnavailable)?;
        file.write_all(&serialized)
            .and_then(|_| file.sync_all())
            .map_err(|_| AuthorityError::RegistryUnavailable)
    }
}

fn reject_symlink(path: &Path) -> Result<(), AuthorityError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| AuthorityError::RegistryUnavailable)?;
    if metadata.file_type().is_symlink() {
        Err(AuthorityError::RegistryUnavailable)
    } else {
        Ok(())
    }
}
