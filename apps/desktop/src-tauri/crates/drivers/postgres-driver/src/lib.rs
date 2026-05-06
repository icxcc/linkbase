use async_trait::async_trait;
use db_common::{
    AppError, ColumnInfo, ConnectionConfig, DatabaseMetadata, DbDriver, IndexInfo, QueryResult,
    RoutineInfo, SchemaInfo, SequenceInfo, TableInfo, TestResult, ViewInfo,
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
}

#[async_trait]
impl DbDriver for PostgresDriver {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), AppError> {
        let url = config.build_connection_string();
        if url.is_empty() {
            return Err(AppError::connection_err("连接字符串为空", None));
        }

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
                        data_type: col.type_info().name().to_string(),
                        nullable: None,
                        default_value: None,
                        is_primary_key: false,
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

        let schema_rows: Vec<(String,)> = sqlx::query_as(
            "SELECT schema_name FROM information_schema.schemata \
             WHERE schema_name NOT IN ('pg_catalog', 'information_schema') \
             ORDER BY schema_name",
        )
        .fetch_all(&pool)
        .await
        .map_err(Self::query_err)?;

        let mut schemas = Vec::new();

        for (schema_name,) in schema_rows {
            let tables = Self::fetch_tables(&pool, &schema_name).await?;
            let views = Self::fetch_views(&pool, &schema_name).await?;
            let materialized_views = Self::fetch_materialized_views(&pool, &schema_name).await?;
            let functions = Self::fetch_routines(&pool, &schema_name, "FUNCTION").await?;
            let procedures = Self::fetch_routines(&pool, &schema_name, "PROCEDURE").await?;
            let sequences = Self::fetch_sequences(&pool, &schema_name).await?;
            let indexes = Self::fetch_indexes(&pool, &schema_name).await?;

            schemas.push(SchemaInfo {
                name: schema_name,
                tables,
                views,
                materialized_views,
                functions,
                procedures,
                sequences,
                indexes,
            });
        }

        Ok(DatabaseMetadata {
            driver_type: "postgres".to_string(),
            databases: vec![],
            schemas,
            tables: vec![],
        })
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
        let url = config.build_connection_string();
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

impl PostgresDriver {
    async fn fetch_tables(
        pool: &sqlx::PgPool,
        schema: &str,
    ) -> Result<Vec<TableInfo>, AppError> {
        let table_rows: Vec<(String,)> = sqlx::query_as(
            "SELECT table_name FROM information_schema.tables \
             WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name",
        )
        .bind(schema)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut tables = Vec::new();
        for (table_name,) in table_rows {
            let columns = Self::fetch_columns(pool, schema, &table_name).await?;
            tables.push(TableInfo {
                name: table_name,
                schema: Some(schema.to_string()),
                columns,
                indexes: vec![],
                constraints: vec![],
            });
        }
        Ok(tables)
    }

    async fn fetch_views(
        pool: &sqlx::PgPool,
        schema: &str,
    ) -> Result<Vec<ViewInfo>, AppError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT table_name FROM information_schema.views \
             WHERE table_schema = $1 ORDER BY table_name",
        )
        .bind(schema)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        Ok(rows
            .into_iter()
            .map(|(name,)| ViewInfo {
                name,
                schema: Some(schema.to_string()),
                definition: None,
            })
            .collect())
    }

    async fn fetch_materialized_views(
        pool: &sqlx::PgPool,
        schema: &str,
    ) -> Result<Vec<ViewInfo>, AppError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT matviewname FROM pg_matviews WHERE schemaname = $1 ORDER BY matviewname",
        )
        .bind(schema)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        Ok(rows
            .into_iter()
            .map(|(name,)| ViewInfo {
                name,
                schema: Some(schema.to_string()),
                definition: None,
            })
            .collect())
    }

    async fn fetch_columns(
        pool: &sqlx::PgPool,
        schema: &str,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, AppError> {
        let col_rows: Vec<(String, String, String, Option<String>)> = sqlx::query_as(
            "SELECT column_name, data_type, is_nullable, column_default \
             FROM information_schema.columns \
             WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position",
        )
        .bind(schema)
        .bind(table_name)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        Ok(col_rows
            .into_iter()
            .map(|(col_name, col_type, nullable, default_val)| ColumnInfo {
                name: col_name,
                data_type: col_type,
                nullable: Some(nullable.eq_ignore_ascii_case("YES")),
                default_value: default_val,
                is_primary_key: false,
            })
            .collect())
    }

    async fn fetch_routines(
        pool: &sqlx::PgPool,
        schema: &str,
        routine_type: &str,
    ) -> Result<Vec<RoutineInfo>, AppError> {
        let rows: Vec<(String, Option<String>)> = sqlx::query_as(
            "SELECT routine_name, data_type FROM information_schema.routines \
             WHERE routine_schema = $1 AND routine_type = $2 ORDER BY routine_name",
        )
        .bind(schema)
        .bind(routine_type)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        Ok(rows
            .into_iter()
            .map(|(name, return_type)| RoutineInfo {
                name,
                routine_type: routine_type.to_string(),
                return_type,
            })
            .collect())
    }

    async fn fetch_sequences(
        pool: &sqlx::PgPool,
        schema: &str,
    ) -> Result<Vec<SequenceInfo>, AppError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT sequence_name FROM information_schema.sequences \
             WHERE sequence_schema = $1 ORDER BY sequence_name",
        )
        .bind(schema)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        Ok(rows
            .into_iter()
            .map(|(name,)| SequenceInfo { name })
            .collect())
    }

    async fn fetch_indexes(
        pool: &sqlx::PgPool,
        schema: &str,
    ) -> Result<Vec<IndexInfo>, AppError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT indexname FROM pg_indexes \
             WHERE schemaname = $1 ORDER BY indexname",
        )
        .bind(schema)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        Ok(rows
            .into_iter()
            .map(|(name,)| IndexInfo {
                name,
                columns: vec![],
                unique: false,
                primary: false,
            })
            .collect())
    }
}
