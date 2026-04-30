use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub driver_type: String,
    pub connection_string: String,
    #[serde(default)]
    pub options: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub execution_time: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected_rows: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub columns: Vec<ColumnInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetadata {
    pub tables: Vec<TableInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
}

impl AppError {
    pub fn connection_err(message: impl Into<String>, detail: Option<&str>) -> Self {
        Self {
            code: "ERR_DB_CONNECTION".to_string(),
            message: message.into(),
            detail: detail.map(|d| d.to_string()),
            suggestion: None,
        }
    }

    pub fn query_err(message: impl Into<String>) -> Self {
        Self {
            code: "ERR_DB_QUERY".to_string(),
            message: message.into(),
            detail: None,
            suggestion: None,
        }
    }

    pub fn not_found(resource: impl Into<String>) -> Self {
        Self {
            code: "ERR_NOT_FOUND".to_string(),
            message: format!("Not found: {}", resource.into()),
            detail: None,
            suggestion: None,
        }
    }

    pub fn other(message: impl Into<String>) -> Self {
        Self {
            code: "ERR_OTHER".to_string(),
            message: message.into(),
            detail: None,
            suggestion: None,
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

#[async_trait]
pub trait DbDriver: Send + Sync {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), AppError>;
    async fn disconnect(&mut self) -> Result<(), AppError>;
    async fn execute(&mut self, sql: &str) -> Result<QueryResult, AppError>;
    async fn get_metadata(&self) -> Result<DatabaseMetadata, AppError>;
}

#[async_trait]
pub trait CancellableQuery: Send + Sync {
    async fn cancel(&self) -> Result<(), AppError>;
}
