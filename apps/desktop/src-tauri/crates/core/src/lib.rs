use dashmap::DashMap;
use db_common::{AppError, ConnectionConfig, DatabaseMetadata, DbDriver, QueryChunk, QueryResult, TestResult};
use mysql_driver::MySqlDriver;
use postgres_driver::PostgresDriver;
use sqlite_driver::SqliteDriver;
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod connection_storage;
pub use connection_storage::{load_connections, load_connections_without_password, get_connection_by_id, load_folders, save_connections, save_folders, StoredConnection, StoredFolder};

pub struct ConnectionManager {
    connections: DashMap<String, Arc<Mutex<Box<dyn DbDriver>>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
        }
    }

    pub async fn connect(&self, id: &str) -> Result<(), AppError> {
        let stored_conn = get_connection_by_id(id)?;
        
        let config = ConnectionConfig {
            driver_type: stored_conn.driver_type,
            host: stored_conn.host,
            port: stored_conn.port,
            user: stored_conn.user,
            password: stored_conn.password,
            database: stored_conn.database,
            connection_string: stored_conn.connection_string,
            options: stored_conn.options.unwrap_or_default(),
        };

        let mut driver: Box<dyn DbDriver> = match config.driver_type.as_str() {
            "sqlite" => Box::new(SqliteDriver::new()),
            "mysql" => Box::new(MySqlDriver::new()),
            "postgres" => Box::new(PostgresDriver::new()),
            other => {
                return Err(AppError::driver_not_found(other));
            }
        };

        driver.connect(&config).await?;
        self.connections
            .insert(id.to_string(), Arc::new(Mutex::new(driver)));
        Ok(())
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

    pub async fn execute_with_context(&self, id: &str, sql: &str, database: Option<&str>) -> Result<QueryResult, AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let mut driver = driver_arc.lock().await;
        // Switch database within the same lock to ensure atomicity
        if let Some(db) = database {
            if !db.is_empty() {
                driver.switch_database(db).await?;
            }
        }
        driver.execute(sql).await
    }

    pub async fn execute_streaming(
        &self,
        id: &str,
        sql: &str,
        chunk_size: usize,
    ) -> Result<tokio::sync::mpsc::Receiver<Result<QueryChunk, AppError>>, AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let mut driver = driver_arc.lock().await;
        driver.execute_streaming(sql, chunk_size).await
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

    pub async fn get_enhanced_metadata(&self, id: &str) -> Result<DatabaseMetadata, AppError> {
        self.get_metadata(id).await
    }

    pub async fn get_databases(&self, id: &str) -> Result<Vec<String>, AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let driver = driver_arc.lock().await;
        driver.get_databases().await
    }

    pub async fn get_schemas(&self, id: &str, database: Option<&str>) -> Result<Vec<String>, AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let driver = driver_arc.lock().await;
        driver.get_schemas(database).await
    }

    pub async fn switch_database(&self, id: &str, database: &str) -> Result<(), AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let mut driver = driver_arc.lock().await;
        driver.switch_database(database).await
    }

    pub async fn cancel_query(&self, id: &str) -> Result<(), AppError> {
        let driver_arc = self
            .connections
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("连接 {}", id)))?
            .clone();

        let driver = driver_arc.lock().await;
        driver.cancel_query().await
    }

    pub async fn test_connection(&self, config: ConnectionConfig) -> Result<TestResult, AppError> {
        let mut driver: Box<dyn DbDriver> = match config.driver_type.as_str() {
            "sqlite" => Box::new(SqliteDriver::new()),
            "mysql" => Box::new(MySqlDriver::new()),
            "postgres" => Box::new(PostgresDriver::new()),
            other => {
                return Err(AppError::driver_not_found(other));
            }
        };

        driver.test_connection(&config).await
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}
