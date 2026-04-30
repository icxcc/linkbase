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

    pub fn connection_timeout(message: impl Into<String>) -> Self {
        Self {
            code: "ERR_CONN_TIMEOUT".to_string(),
            message: message.into(),
            detail: None,
            suggestion: Some("请检查主机地址和端口是否正确，或网络连接是否正常".to_string()),
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

    pub fn query_cancelled() -> Self {
        Self {
            code: "ERR_QUERY_CANCELLED".to_string(),
            message: "查询已被用户取消".to_string(),
            detail: None,
            suggestion: None,
        }
    }

    pub fn driver_not_found(driver_type: impl Into<String>) -> Self {
        Self {
            code: "ERR_DRIVER_NOT_FOUND".to_string(),
            message: format!("不支持的驱动类型: {}", driver_type.into()),
            detail: None,
            suggestion: Some("请确认已安装对应数据库的驱动插件".to_string()),
        }
    }

    pub fn ssh_tunnel_err(message: impl Into<String>) -> Self {
        Self {
            code: "ERR_SSH_TUNNEL".to_string(),
            message: message.into(),
            detail: None,
            suggestion: Some("请检查SSH连接参数".to_string()),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub success: bool,
    pub latency_ms: f64,
    pub server_version: String,
    pub ssl_status: String,
    pub driver_info: String,
}

#[async_trait]
pub trait DbDriver: Send + Sync {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), AppError>;
    async fn disconnect(&mut self) -> Result<(), AppError>;
    async fn execute(&mut self, sql: &str) -> Result<QueryResult, AppError>;
    async fn get_metadata(&self) -> Result<DatabaseMetadata, AppError>;
    async fn cancel_query(&self) -> Result<(), AppError> {
        Err(AppError::other("该驱动不支持取消查询"))
    }
    async fn test_connection(&mut self, _config: &ConnectionConfig) -> Result<TestResult, AppError> {
        Err(AppError::other("该驱动不支持测试连接"))
    }
}
