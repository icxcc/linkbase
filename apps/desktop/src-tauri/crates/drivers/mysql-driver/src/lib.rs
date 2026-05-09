use async_trait::async_trait;
use db_common::{
    AppError, ColumnInfo, ConnectionConfig, DatabaseInfo, DatabaseMetadata, DbDriver, EventInfo,
    QueryResult, RoutineInfo, TableInfo, TestResult, TriggerInfo, UserInfo, ViewInfo,
};
use sqlx::mysql::{MySqlPool, MySqlRow};
use sqlx::{Column, Row, TypeInfo, ValueRef};
use std::sync::Mutex;
use std::time::Instant;

pub struct MySqlDriver {
    pool: Mutex<Option<MySqlPool>>,
    connection_id: Mutex<Option<u32>>,
    connection_url: Mutex<Option<String>>,
}

impl MySqlDriver {
    pub fn new() -> Self {
        Self {
            pool: Mutex::new(None),
            connection_id: Mutex::new(None),
            connection_url: Mutex::new(None),
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
            || s.starts_with("SHOW")
            || s.starts_with("DESCRIBE")
            || s.starts_with("EXPLAIN")
            || s.starts_with("WITH")
    }

    fn extract_value(row: &MySqlRow, index: usize) -> Result<serde_json::Value, sqlx::Error> {
        let raw = row.try_get_raw(index)?;
        if raw.is_null() {
            return Ok(serde_json::Value::Null);
        }

        let type_name = raw.type_info().name().to_uppercase();

        match type_name.as_str() {
            "JSON" => row.try_get::<serde_json::Value, _>(index),
            "TINYINT"
            | "SMALLINT"
            | "MEDIUMINT"
            | "INT"
            | "INTEGER"
            | "BIGINT"
            | "YEAR"
            | "BIT" => row
                .try_get::<i64, _>(index)
                .map(|v| serde_json::Value::Number(v.into())),
            "FLOAT" | "DOUBLE" | "REAL" => row.try_get::<f64, _>(index).map(|v| {
                serde_json::Number::from_f64(v)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            }),
            "DECIMAL" | "NUMERIC" => {
                row.try_get::<String, _>(index).map(|v| {
                    v.parse::<serde_json::Number>()
                        .map(serde_json::Value::Number)
                        .unwrap_or_else(|_| serde_json::Value::String(v))
                })
            }
            "BOOL" | "BOOLEAN" => row
                .try_get::<bool, _>(index)
                .map(serde_json::Value::Bool),
            "BLOB" | "BINARY" | "VARBINARY" | "LONGBLOB" | "MEDIUMBLOB" | "TINYBLOB" => {
                row.try_get::<Vec<u8>, _>(index).map(|bytes| {
                    serde_json::Value::String(format!("<BLOB {} bytes>", bytes.len()))
                })
            }
            _ => row
                .try_get::<String, _>(index)
                .map(serde_json::Value::String),
        }
    }

    fn get_string_from_row(row: &MySqlRow, index: usize) -> Option<String> {
        match row.try_get::<String, _>(index) {
            Ok(v) => Some(v),
            Err(_) => match row.try_get::<Vec<u8>, _>(index) {
                Ok(bytes) => Some(String::from_utf8_lossy(&bytes).to_string()),
                Err(_) => None,
            },
        }
    }

    async fn fetch_tables(
        pool: &MySqlPool,
        database: &str,
    ) -> Result<Vec<TableInfo>, AppError> {
        let rows: Vec<MySqlRow> = sqlx::query(
            "SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES \
             WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
        )
        .bind(database)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut tables = Vec::new();
        for row in rows {
            let table_name = match Self::get_string_from_row(&row, 0) {
                Some(v) => v,
                None => continue,
            };
            let columns = Self::fetch_columns(pool, database, &table_name).await?;
            tables.push(TableInfo {
                name: table_name,
                schema: Some(database.to_string()),
                columns,
                indexes: vec![],
                constraints: vec![],
            });
        }
        Ok(tables)
    }

    async fn fetch_views(
        pool: &MySqlPool,
        database: &str,
    ) -> Result<Vec<ViewInfo>, AppError> {
        let rows: Vec<MySqlRow> = sqlx::query(
            "SELECT TABLE_NAME FROM information_schema.TABLES \
             WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME",
        )
        .bind(database)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut views = Vec::new();
        for row in rows {
            let name = match Self::get_string_from_row(&row, 0) {
                Some(v) => v,
                None => continue,
            };
            views.push(ViewInfo {
                name,
                schema: Some(database.to_string()),
                definition: None,
            });
        }
        Ok(views)
    }

    async fn fetch_columns(
        pool: &MySqlPool,
        database: &str,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, AppError> {
        let rows: Vec<MySqlRow> = sqlx::query(
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY \
             FROM information_schema.COLUMNS \
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
        )
        .bind(database)
        .bind(table_name)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut columns = Vec::new();
        for row in rows {
            let col_name = match Self::get_string_from_row(&row, 0) {
                Some(v) => v,
                None => continue,
            };
            let col_type = match Self::get_string_from_row(&row, 1) {
                Some(v) => v,
                None => continue,
            };
            let nullable = match Self::get_string_from_row(&row, 2) {
                Some(v) => v.eq_ignore_ascii_case("YES"),
                None => false,
            };
            let default_val: Option<String> = match row.try_get(3) {
                Ok(v) => v,
                Err(_) => None,
            };
            let column_key = match Self::get_string_from_row(&row, 4) {
                Some(v) => v,
                None => String::new(),
            };
            columns.push(ColumnInfo {
                name: col_name,
                data_type: col_type,
                nullable: Some(nullable),
                default_value: default_val,
                is_primary_key: column_key.eq_ignore_ascii_case("PRI"),
            });
        }
        Ok(columns)
    }

    async fn fetch_routines(
        pool: &MySqlPool,
        database: &str,
        routine_type: &str,
    ) -> Result<Vec<RoutineInfo>, AppError> {
        let rows: Vec<MySqlRow> = sqlx::query(
            "SELECT ROUTINE_NAME, DTD_IDENTIFIER FROM information_schema.ROUTINES \
             WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = ? ORDER BY ROUTINE_NAME",
        )
        .bind(database)
        .bind(routine_type)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut routines = Vec::new();
        for row in rows {
            let name = match Self::get_string_from_row(&row, 0) {
                Some(v) => v,
                None => continue,
            };
            let return_type: Option<String> = match row.try_get(1) {
                Ok(v) => v,
                Err(_) => None,
            };
            routines.push(RoutineInfo {
                name,
                routine_type: routine_type.to_string(),
                return_type,
            });
        }
        Ok(routines)
    }

    async fn fetch_users(pool: &MySqlPool) -> Result<Vec<UserInfo>, AppError> {
        let rows: Result<Vec<MySqlRow>, _> = sqlx::query("SELECT user, host FROM mysql.user ORDER BY user")
            .fetch_all(pool)
            .await;

        match rows {
            Ok(rows) => {
                let mut users = Vec::new();
                for row in rows {
                    let user: String = match row.try_get(0) {
                        Ok(v) => v,
                        Err(_) => match row.try_get::<Vec<u8>, _>(0) {
                            Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                            Err(_) => continue,
                        },
                    };
                    let host: String = match row.try_get(1) {
                        Ok(v) => v,
                        Err(_) => match row.try_get::<Vec<u8>, _>(1) {
                            Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                            Err(_) => continue,
                        },
                    };
                    users.push(UserInfo {
                        name: user,
                        host: Some(host),
                    });
                }
                Ok(users)
            }
            Err(_) => Ok(vec![]),
        }
    }

    async fn fetch_triggers(
        pool: &MySqlPool,
        database: &str,
    ) -> Result<Vec<TriggerInfo>, AppError> {
        let rows: Vec<MySqlRow> = sqlx::query(
            "SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION \
             FROM information_schema.TRIGGERS \
             WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME",
        )
        .bind(database)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut triggers = Vec::new();
        for row in rows {
            let name = match Self::get_string_from_row(&row, 0) {
                Some(v) => v,
                None => continue,
            };
            let table_name = Self::get_string_from_row(&row, 1);
            let timing = Self::get_string_from_row(&row, 2);
            let event = Self::get_string_from_row(&row, 3);
            triggers.push(TriggerInfo {
                name,
                table_name,
                timing,
                event,
                definition: None,
            });
        }
        Ok(triggers)
    }

    async fn fetch_events(
        pool: &MySqlPool,
        database: &str,
    ) -> Result<Vec<EventInfo>, AppError> {
        let rows: Vec<MySqlRow> = sqlx::query(
            "SELECT EVENT_NAME, INTERVAL_VALUE, INTERVAL_FIELD, STATUS \
             FROM information_schema.EVENTS \
             WHERE EVENT_SCHEMA = ? ORDER BY EVENT_NAME",
        )
        .bind(database)
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut events = Vec::new();
        for row in rows {
            let name = match Self::get_string_from_row(&row, 0) {
                Some(v) => v,
                None => continue,
            };
            let interval_value: Option<String> = row.try_get(1).ok();
            let interval_field: Option<String> = row.try_get(2).ok();
            let status_str: Option<String> = row.try_get(3).ok();
            let schedule = match (interval_value, interval_field) {
                (Some(v), Some(f)) => Some(format!("{} {}", v, f)),
                (Some(v), None) => Some(v),
                (None, Some(f)) => Some(f),
                (None, None) => None,
            };
            let enabled = status_str.map(|s| s.eq_ignore_ascii_case("ENABLED"));
            events.push(EventInfo {
                name,
                schedule,
                enabled,
                definition: None,
            });
        }
        Ok(events)
    }

    async fn fetch_databases(pool: &MySqlPool) -> Result<Vec<String>, AppError> {
        let rows: Vec<MySqlRow> = sqlx::query(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME",
        )
        .fetch_all(pool)
        .await
        .map_err(Self::query_err)?;

        let mut databases = Vec::new();
        for row in rows {
            if let Some(name) = Self::get_string_from_row(&row, 0) {
                databases.push(name);
            }
        }
        Ok(databases)
    }
}

#[async_trait]
impl DbDriver for MySqlDriver {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), AppError> {
        let url = config.build_connection_string();
        if url.is_empty() {
            return Err(AppError::connection_err("连接字符串为空", None));
        }

        let pool = match MySqlPool::connect(&url).await {
            Ok(p) => p,
            Err(e) => {
                let err_msg = e.to_string();
                if err_msg.contains("timeout") || err_msg.contains("timed out") {
                    return Err(AppError::connection_timeout(err_msg));
                }
                return Err(AppError::connection_err(
                    format!("连接失败: {}, {}", url, err_msg),
                    None,
                ));
            }
        };

        let conn_id: (u64,) = sqlx::query_as("SELECT CONNECTION_ID()")
            .fetch_one(&pool)
            .await
            .map_err(Self::conn_err)?;

        {
            let mut url_guard = self
                .connection_url
                .lock()
                .map_err(|_| Self::mutex_poisoned())?;
            *url_guard = Some(url);
        }
        {
            let mut id_guard = self
                .connection_id
                .lock()
                .map_err(|_| Self::mutex_poisoned())?;
            *id_guard = Some(conn_id.0 as u32);
        }
        {
            let mut pool_guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            *pool_guard = Some(pool);
        }

        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), AppError> {
        let pool = {
            let mut pool_guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            pool_guard.take()
        };
        if let Some(pool) = pool {
            pool.close().await;
        }
        let mut id_guard = self
            .connection_id
            .lock()
            .map_err(|_| Self::mutex_poisoned())?;
        *id_guard = None;
        let mut url_guard = self
            .connection_url
            .lock()
            .map_err(|_| Self::mutex_poisoned())?;
        *url_guard = None;
        Ok(())
    }

    async fn execute(&mut self, sql: &str) -> Result<QueryResult, AppError> {
        let start = Instant::now();
        let pool = {
            let guard = self.pool.lock().map_err(|_| Self::mutex_poisoned())?;
            guard.as_ref().ok_or_else(Self::not_connected)?.clone()
        };

        if Self::is_query_statement(sql) {
            let rows: Vec<MySqlRow> = sqlx::query::<sqlx::MySql>(sql)
                .fetch_all(&pool)
                .await
                .map_err(Self::query_err)?;

            let columns: Vec<ColumnInfo> = if let Some(first) = rows.first() {
                first
                    .columns()
                    .iter()
                    .map(|c| ColumnInfo {
                        name: c.name().to_string(),
                        data_type: c.type_info().name().to_string(),
                        nullable: None,
                        default_value: None,
                        is_primary_key: false,
                    })
                    .collect()
            } else {
                vec![]
            };

            let col_count = columns.len();
            let mut result_rows = Vec::with_capacity(rows.len());
            for row in &rows {
                let mut values = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    let val = Self::extract_value(row, i).unwrap_or(serde_json::Value::Null);
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
            let result = sqlx::query::<sqlx::MySql>(sql)
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

        let db_names = Self::fetch_databases(&pool).await?;

        let mut databases = Vec::new();

        for db_name in db_names {
            let tables = Self::fetch_tables(&pool, &db_name).await?;
            let views = Self::fetch_views(&pool, &db_name).await?;
            let functions = Self::fetch_routines(&pool, &db_name, "FUNCTION").await?;
            let procedures = Self::fetch_routines(&pool, &db_name, "PROCEDURE").await?;
            let triggers = Self::fetch_triggers(&pool, &db_name).await?;
            let events = Self::fetch_events(&pool, &db_name).await?;

            databases.push(DatabaseInfo {
                name: db_name,
                tables,
                views,
                functions,
                procedures,
                users: vec![],
                triggers,
                events,
                roles: vec![],
                tablespaces: vec![],
                schemas: vec![],
            });
        }

        let users = Self::fetch_users(&pool).await?;

        Ok(DatabaseMetadata {
            driver_type: "mysql".to_string(),
            databases,
            schemas: vec![],
            tables: vec![],
            roles: vec![],
            tablespaces: vec![],
            users,
        })
    }

    async fn cancel_query(&self) -> Result<(), AppError> {
        let connection_id = {
            let id_guard = self
                .connection_id
                .lock()
                .map_err(|_| Self::mutex_poisoned())?;
            id_guard.ok_or_else(Self::not_connected)?
        };

        let url = {
            let url_guard = self
                .connection_url
                .lock()
                .map_err(|_| Self::mutex_poisoned())?;
            url_guard
                .as_ref()
                .ok_or_else(|| AppError::connection_err("连接URL不可用", None))?
                .clone()
        };

        let temp_pool = MySqlPool::connect(url.as_str())
            .await
            .map_err(Self::conn_err)?;

        let kill_sql = format!("KILL QUERY {}", connection_id);
        sqlx::query::<sqlx::MySql>(&kill_sql)
            .execute(&temp_pool)
            .await
            .map_err(|e| AppError::other(format!("取消查询失败: {}", e)))?;

        temp_pool.close().await;
        Ok(())
    }

    async fn test_connection(&mut self, config: &ConnectionConfig) -> Result<TestResult, AppError> {
        let url = config.build_connection_string();
        let start = Instant::now();

        let pool = MySqlPool::connect(&url)
            .await
            .map_err(|e| {
                let err_msg = e.to_string();
                if err_msg.contains("timeout") || err_msg.contains("timed out") {
                    AppError::connection_timeout(err_msg)
                } else {
                    AppError::connection_err(
                        format!("连接失败: {}, {}", url, err_msg),
                        None,
                    )
                }
            })?;

        let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

        let version: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&pool)
            .await
            .map_err(Self::query_err)?;

        let ssl_status = if url.contains("ssl") || url.contains("tls") {
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
            driver_info: "MySQL via sqlx".to_string(),
        })
    }
}