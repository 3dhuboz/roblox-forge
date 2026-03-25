use crate::validation::checks;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub id: String,
    pub severity: String,
    pub message: String,
    pub location: Option<String>,
    pub auto_fixable: bool,
    pub fix_description: Option<String>,
}

impl From<checks::ValidationIssue> for ValidationIssue {
    fn from(issue: checks::ValidationIssue) -> Self {
        Self {
            id: issue.id,
            severity: issue.severity,
            message: issue.message,
            location: issue.location,
            auto_fixable: issue.auto_fixable,
            fix_description: issue.fix_description,
        }
    }
}

#[tauri::command]
pub async fn validate_project(project_path: String) -> Result<Vec<ValidationIssue>, String> {
    let issues = checks::validate(&project_path);
    Ok(issues.into_iter().map(|i| i.into()).collect())
}
