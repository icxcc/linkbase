use dashmap::DashMap;
use db_common::{AppError, ConnectionConfig, DatabaseMetadata, DbDriver, QueryResult};
use sqlite_driver::SqliteDriver;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct ConnectionManager {
    connections: DashMap<String, Arc<Mutex<Box<dyn DbDriver>>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
        }
    }

    pub async fn connect(&self, config: ConnectionConfig) -> Result<String, AppError> {
        let mut driver: Box<dyn DbDriver> = match config.driver_type.as_str() {
            "sqlite" => Box::new(SqliteDriver::new()),
            other => {
                return Err(AppError::other(format!(
                    "不支持的驱动类型: {}",
                    other
                )))
            }
        };

        driver.connect(&config).await?;
        let id = uuid::Uuid::new_v4().to_string();
        self.connections
            .insert(id.clone(), Arc::new(Mutex::new(driver)));
        Ok(id)
    }

    pub async fn disconnect(&self, id: &str) -> Result<(), AppError> {
        let entry = self
            .connections
            .remove(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?;

        let mut driver = entry.1.lock().await;
        driver.disconnect().await
    }

    pub async fn execute(&self, id: &str, sql: &str) -> Result<QueryResult, AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let mut driver = driver_arc.lock().await;
        driver.execute(sql).await
    }

    pub async fn get_metadata(&self, id: &str) -> Result<DatabaseMetadata, AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let driver = driver_arc.lock().await;
        driver.get_metadata().await
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}
