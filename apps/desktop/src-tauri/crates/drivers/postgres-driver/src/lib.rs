use async_trait::async_trait;
use db_common::{
    AppError, ColumnInfo, ConnectionConfig, DatabaseMetadata, DbDriver, QueryResult, TableInfo,
    TestResult,
};
use sqlx::{Column, Row};
use std::sync::Mutex;
use std::time::Instant;

pub struct PostgresDriver {
    pool: Mutex<Option<sqlx::PgPool>>,
    backend_pid: Mutex<Option<i32>>,
}

impl PostgresDriver {
    pub fn new() -> Self {
        Self {
            pool: Mutex::new(None),
            backend_pid: Mutex::new(None),
        }
    }

    fn conn_err(err: sqlx::Error) -> AppError {
        AppError::connection_err(err.to_string(), None)
    }

    fn query_err(err: sqlx::Error) -> AppError {
        AppError::query_err(err.to_string())
    }

    fn mutex_poisoned() -> AppError {
        AppError::other("内部锁错误")
    }

    fn not_connected() -> AppError {
        AppError::connection_err("未连接到数据库", None)
    }

    fn is_query_statement(sql: &str) -> bool {
        let s = sql.trim_start().to_uppercase();
        s.starts_with("SELECT")
            || s.starts_with("WITH")
            || s.starts_with("EXPLAIN")
            || s.starts_with("DESCRIBE")
            || s.starts_with("SHOW")
    }

    fn build_url_from_options(options: &serde_json::Value) -> Result<String, AppError> {
        let host = options["host"].as_str().unwrap_or("localhost");
        let port = options["port"].as_u64().filter(|&p| p > 0).unwrap_or(5432);
        let user = options["user"].as_str().unwrap_or("postgres");
        let password = options["password"].as_str().unwrap_or("");
        let database = options["database"].as_str().unwrap_or("postgres");
        let sslmode = options["sslmode"].as_str().unwrap_or("prefer");

        let mut url = String::from("postgres://");

        if !user.is_empty() {
            url.push_str(user);
            if !password.is_empty() {
                url.push(':');
                // URL-encode password to handle special characters
                url.push_str(
                    &urlencoding_maybe(password),
                );
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

        Ok(url)
    }
}

fn urlencoding_maybe(s: &str) -> String {
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

#[async_trait]
impl DbDriver for PostgresDriver {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), AppError> {
        if config.connection_string.is_empty() {
            return Err(AppError::connection_err("连接字符串为空", None));
        }
        let url = config.connection_string.clone();

        let pool = match sqlx::PgPool::connect(&url).await {
            Ok(p) => p,
            Err(e) => {
                let err_msg = e.to_string();
                if err_msg.contains("timeout") || err_msg.contains("timed out") {
                    return Err(AppError::connection_timeout(err_msg));
                }
                return Err(Self::conn_err(e));
            }
        };

        let backend_pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&pool)
            .await
            .map_err(Self::query_err)?;

        {
            let mut guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            *guard = Some(pool);
        }

        {
            let mut guard = self.backend_pid.lock().map_err(|_| Self::mutex_poisoned())?;
            *guard = Some(backend_pid);
        }

        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), AppError> {
        let pool = {
            let mut guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            guard.take()
        };
        if let Some(pool) = pool {
            pool.close().await;
        }

        let mut pid_guard = self.backend_pid.lock().map_err(|_| Self::mutex_poisoned())?;
        *pid_guard = None;

        Ok(())
    }

    async fn execute(&mut self, sql: &str) -> Result<QueryResult, AppError> {
        let start = Instant::now();
        let pool = {
            let guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            guard.as_ref().ok_or_else(Self::not_connected)?.clone()
        };

        if Self::is_query_statement(sql) {
            let rows = sqlx::query(sql)
                .fetch_all(&pool)
                .await
                .map_err(Self::query_err)?;

            let columns: Vec<ColumnInfo> = if let Some(first_row) = rows.first() {
                first_row
                    .columns()
                    .iter()
                    .map(|col| ColumnInfo {
                        name: col.name().to_string(),
                        data_type: String::new(),
                    })
                    .collect()
            } else {
                vec![]
            };

            let column_count = columns.len();
            let mut result_rows = Vec::with_capacity(rows.len());

            for row in &rows {
                let mut values = Vec::with_capacity(column_count);
                for i in 0..column_count {
                    let val = row
                        .try_get::<serde_json::Value, _>(i)
                        .unwrap_or(serde_json::Value::Null);
                    values.push(val);
                }
                result_rows.push(values);
            }

            let row_count = result_rows.len();
            let execution_time = start.elapsed().as_secs_f64() * 1000.0;

            Ok(QueryResult {
                columns,
                rows: result_rows,
                row_count,
                execution_time,
                affected_rows: None,
            })
        } else {
            let result = sqlx::query(sql)
                .execute(&pool)
                .await
                .map_err(Self::query_err)?;

            let affected = result.rows_affected() as usize;
            let execution_time = start.elapsed().as_secs_f64() * 1000.0;

            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                row_count: 0,
                execution_time,
                affected_rows: Some(affected),
            })
        }
    }

    async fn get_metadata(&self) -> Result<DatabaseMetadata, AppError> {
        let pool = {
            let guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            guard.as_ref().ok_or_else(Self::not_connected)?.clone()
        };

        let table_rows = sqlx::query(
            "SELECT table_schema, table_name FROM information_schema.tables \
             WHERE table_schema NOT IN ('pg_catalog', 'information_schema') \
             ORDER BY table_schema, table_name",
        )
        .fetch_all(&pool)
        .await
        .map_err(Self::query_err)?;

        let mut tables = Vec::new();

        for trow in &table_rows {
            let schema: String = trow.try_get(0).unwrap_or_default();
            let table_name: String = trow.try_get(1).unwrap_or_default();
            let full_name = format!("{}.{}", schema, table_name);

            let col_rows = sqlx::query(
                "SELECT column_name, data_type FROM information_schema.columns \
                 WHERE table_schema = $1 AND table_name = $2 \
                 ORDER BY ordinal_position",
            )
            .bind(&schema)
            .bind(&table_name)
            .fetch_all(&pool)
            .await
            .map_err(Self::query_err)?;

            let mut columns = Vec::with_capacity(col_rows.len());
            for crow in &col_rows {
                let col_name: String = crow.try_get(0).unwrap_or_default();
                let col_type: String = crow.try_get(1).unwrap_or_default();
                columns.push(ColumnInfo {
                    name: col_name,
                    data_type: col_type,
                });
            }

            tables.push(TableInfo {
                name: full_name,
                columns,
            });
        }

        Ok(DatabaseMetadata { tables })
    }

    async fn cancel_query(&self) -> Result<(), AppError> {
        let pid = {
            let guard = self.backend_pid.lock().map_err(|_| Self::mutex_poisoned())?;
            guard.ok_or_else(Self::not_connected)?
        };
        let pool = {
            let guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            guard.as_ref().ok_or_else(Self::not_connected)?.clone()
        };

        sqlx::query("SELECT pg_cancel_backend($1)")
            .bind(pid)
            .execute(&pool)
            .await
            .map_err(Self::query_err)?;

        Ok(())
    }

    async fn test_connection(&mut self, config: &ConnectionConfig) -> Result<TestResult, AppError> {
        let url = config.connection_string.clone();
        if url.is_empty() {
            return Err(AppError::connection_err("连接字符串为空", None));
        }
        let start = Instant::now();

        let pool = match sqlx::PgPool::connect(&url).await {
            Ok(p) => p,
            Err(e) => {
                let err_msg = e.to_string();
                if err_msg.contains("timeout") || err_msg.contains("timed out") {
                    return Err(AppError::connection_timeout(err_msg));
                }
                return Err(Self::conn_err(e));
            }
        };

        let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

        let version: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&pool)
            .await
            .map_err(Self::query_err)?;

        let ssl_status = if url.contains("sslmode=require") || url.contains("sslmode=verify") {
            "已启用".to_string()
        } else {
            "未启用".to_string()
        };

        pool.close().await;

        Ok(TestResult {
            success: true,
            latency_ms,
            server_version: version.0,
            ssl_status,
            driver_info: "PostgreSQL via sqlx".to_string(),
        })
    }
}
