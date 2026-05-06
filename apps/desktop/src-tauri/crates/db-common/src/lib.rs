use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub driver_type: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub user: Option<String>,
    pub password: Option<String>,
    pub database: Option<String>,
    pub connection_string: Option<String>,
    #[serde(default)]
    pub options: serde_json::Value,
}

impl ConnectionConfig {
    pub fn build_connection_string(&self) -> String {
        if let Some(ref cs) = self.connection_string {
            if !cs.is_empty() {
                return cs.clone();
            }
        }
        match self.driver_type.as_str() {
            "sqlite" => self.connection_string.clone().unwrap_or_default(),
            "mysql" => {
                let host = self.host.as_deref().unwrap_or("localhost");
                let port = self.port.unwrap_or(3306);
                let user = self.user.as_deref().unwrap_or("root");
                let password = self.password.as_deref().unwrap_or("");
                if let Some(ref db) = self.database {
                    if password.is_empty() {
                        format!("mysql://{}@{}:{}/{}", user, host, port, db)
                    } else {
                        format!("mysql://{}:{}@{}:{}/{}", user, password, host, port, db)
                    }
                } else if password.is_empty() {
                    format!("mysql://{}@{}:{}", user, host, port)
                } else {
                    format!("mysql://{}:{}@{}:{}", user, password, host, port)
                }
            }
            "postgres" => {
                let host = self.host.as_deref().unwrap_or("localhost");
                let port = self.port.unwrap_or(5432);
                let user = self.user.as_deref().unwrap_or("postgres");
                let password = self.password.as_deref().unwrap_or("");
                let database = self.database.as_deref().unwrap_or("postgres");
                let sslmode = self
                    .options
                    .get("sslmode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("prefer");

                let mut url = String::from("postgres://");
                if !user.is_empty() {
                    url.push_str(user);
                    if !password.is_empty() {
                        url.push(':');
                        url.push_str(&encode_url_component(password));
                    }
                    url.push('@');
                }
                url.push_str(host);
                url.push(':');
                url.push_str(&port.to_string());
                url.push('/');
                url.push_str(database);
                if !sslmode.is_empty() {
                    url.push_str("?sslmode=");
                    url.push_str(sslmode);
                }
                url
            }
            _ => self.connection_string.clone().unwrap_or_default(),
        }
    }
}

fn encode_url_component(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            ':' | '@' | '/' | '?' | '#' | '[' | ']' | '%' | ' ' => {
                result.push_str(&format!("%{:02X}", ch as u8));
            }
            _ => result.push(ch),
        }
    }
    result
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nullable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    #[serde(default)]
    pub is_primary_key: bool,
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
    pub schema: Option<String>,
    pub columns: Vec<ColumnInfo>,
    #[serde(default)]
    pub indexes: Vec<IndexInfo>,
    #[serde(default)]
    pub constraints: Vec<ConstraintInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewInfo {
    pub name: String,
    pub schema: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub definition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutineInfo {
    pub name: String,
    pub routine_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub return_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceInfo {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintInfo {
    pub name: String,
    pub constraint_type: String,
    pub columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInfo {
    pub name: String,
    #[serde(default)]
    pub tables: Vec<TableInfo>,
    #[serde(default)]
    pub views: Vec<ViewInfo>,
    #[serde(default)]
    pub functions: Vec<RoutineInfo>,
    #[serde(default)]
    pub procedures: Vec<RoutineInfo>,
    #[serde(default)]
    pub users: Vec<UserInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaInfo {
    pub name: String,
    #[serde(default)]
    pub tables: Vec<TableInfo>,
    #[serde(default)]
    pub views: Vec<ViewInfo>,
    #[serde(default)]
    pub materialized_views: Vec<ViewInfo>,
    #[serde(default)]
    pub functions: Vec<RoutineInfo>,
    #[serde(default)]
    pub procedures: Vec<RoutineInfo>,
    #[serde(default)]
    pub sequences: Vec<SequenceInfo>,
    #[serde(default)]
    pub indexes: Vec<IndexInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetadata {
    pub driver_type: String,
    #[serde(default)]
    pub databases: Vec<DatabaseInfo>,
    #[serde(default)]
    pub schemas: Vec<SchemaInfo>,
    #[serde(default)]
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
