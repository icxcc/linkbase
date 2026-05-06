use async_trait::async_trait;
use db_common::{
    AppError, ColumnInfo, ConnectionConfig, DatabaseMetadata, DbDriver, IndexInfo, QueryResult,
    TableInfo, TestResult, ViewInfo,
};
use rusqlite::{types::ValueRef, Connection};
use std::sync::Mutex;
use std::time::Instant;

pub struct SqliteDriver {
    conn: Mutex<Option<Connection>>,
}

impl SqliteDriver {
    pub fn new() -> Self {
        Self {
            conn: Mutex::new(None),
        }
    }

    fn conn_err(err: rusqlite::Error) -> AppError {
        AppError::connection_err(err.to_string(), None)
    }

    fn query_err(err: rusqlite::Error) -> AppError {
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
            || s.starts_with("PRAGMA")
            || s.starts_with("WITH")
            || s.starts_with("EXPLAIN")
            || s.starts_with("DESCRIBE")
    }
}

#[async_trait]
impl DbDriver for SqliteDriver {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), AppError> {
        let path = config.build_connection_string();
        let path = if path.is_empty() {
            config
                .connection_string
                .as_deref()
                .unwrap_or(":memory:")
                .to_string()
        } else {
            path
        };
        let conn = if path == ":memory:" {
            Connection::open_in_memory().map_err(Self::conn_err)?
        } else {
            Connection::open(&path).map_err(Self::conn_err)?
        };
        let mut guard = self.conn.lock().map_err(|_| Self::mutex_poisoned())?;
        *guard = Some(conn);
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), AppError> {
        let mut guard = self.conn.lock().map_err(|_| Self::mutex_poisoned())?;
        guard.take();
        Ok(())
    }

    async fn execute(&mut self, sql: &str) -> Result<QueryResult, AppError> {
        let start = Instant::now();
        let mut guard = self.conn.lock().map_err(|_| Self::mutex_poisoned())?;
        let conn = guard.as_mut().ok_or_else(Self::not_connected)?;

        if Self::is_query_statement(sql) {
            let mut stmt = conn.prepare(sql).map_err(Self::query_err)?;
            let column_names: Vec<String> =
                stmt.column_names().iter().map(|s| s.to_string()).collect();
            let column_count = column_names.len();

            let columns: Vec<ColumnInfo> = column_names
                .iter()
                .map(|n| ColumnInfo {
                    name: n.clone(),
                    data_type: "TEXT".to_string(),
                    nullable: None,
                    default_value: None,
                    is_primary_key: false,
                })
                .collect();

            let rows_iter = stmt
                .query_map([], |row| {
                    let mut values = Vec::with_capacity(column_count);
                    for i in 0..column_count {
                        let val = row.get_ref(i).unwrap_or(ValueRef::Null);
                        let json_val = match val {
                            ValueRef::Null => serde_json::Value::Null,
                            ValueRef::Integer(v) => serde_json::Value::Number(v.into()),
                            ValueRef::Real(v) => serde_json::Number::from_f64(v)
                                .map(serde_json::Value::Number)
                                .unwrap_or(serde_json::Value::Null),
                            ValueRef::Text(v) => serde_json::Value::String(
                                String::from_utf8_lossy(v).to_string(),
                            ),
                            ValueRef::Blob(v) => {
                                serde_json::Value::String(format!("<BLOB {} bytes>", v.len()))
                            }
                        };
                        values.push(json_val);
                    }
                    Ok(values)
                })
                .map_err(Self::query_err)?;

            let mut rows = Vec::new();
            for row in rows_iter {
                rows.push(row.map_err(Self::query_err)?);
            }

            let row_count = rows.len();
            let execution_time = start.elapsed().as_secs_f64() * 1000.0;

            Ok(QueryResult {
                columns,
                rows,
                row_count,
                execution_time,
                affected_rows: None,
            })
        } else {
            let affected = conn.execute(sql, []).map_err(Self::query_err)?;
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
        let guard = self.conn.lock().map_err(|_| Self::mutex_poisoned())?;
        let conn = guard.as_ref().ok_or_else(Self::not_connected)?;

        let mut metadata_tables = Self::fetch_tables(conn)?;
        let views = Self::fetch_views(conn)?;

        let driver_views: Vec<db_common::ViewInfo> = views;
        for view in &driver_views {
            metadata_tables.push(TableInfo {
                name: view.name.clone(),
                schema: None,
                columns: vec![],
                indexes: vec![],
                constraints: vec![],
            })
        }

        Ok(DatabaseMetadata {
            driver_type: "sqlite".to_string(),
            databases: vec![],
            schemas: vec![],
            tables: metadata_tables,
        })
    }

    async fn test_connection(&mut self, config: &ConnectionConfig) -> Result<TestResult, AppError> {
        let start = Instant::now();

        let path = config.build_connection_string();
        let path = if path.is_empty() {
            config
                .connection_string
                .as_deref()
                .unwrap_or(":memory:")
                .to_string()
        } else {
            path
        };

        if path != ":memory:" && !std::path::Path::new(&path).exists() {
            return Err(AppError::connection_err(
                format!("数据库文件不存在: {}", path),
                None,
            ));
        }

        let conn = if path == ":memory:" {
            Connection::open_in_memory().map_err(Self::conn_err)?
        } else {
            Connection::open(&path).map_err(Self::conn_err)?
        };

        let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

        let version: String = conn
            .query_row("SELECT sqlite_version()", [], |row| row.get(0))
            .unwrap_or_else(|_| "unknown".to_string());

        let _ = conn.close();

        Ok(TestResult {
            success: true,
            latency_ms,
            server_version: format!("SQLite {}", version),
            ssl_status: "N/A".to_string(),
            driver_info: "SQLite via rusqlite".to_string(),
        })
    }
}

impl SqliteDriver {
    fn fetch_tables(conn: &Connection) -> Result<Vec<TableInfo>, AppError> {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .map_err(Self::query_err)?;

        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(Self::query_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(Self::query_err)?;

        let mut tables = Vec::new();
        for name in table_names {
            let columns = Self::fetch_columns(conn, &name)?;
            let indexes = Self::fetch_table_indexes(conn, &name)?;
            tables.push(TableInfo {
                name,
                schema: None,
                columns,
                indexes,
                constraints: vec![],
            });
        }
        Ok(tables)
    }

    fn fetch_views(conn: &Connection) -> Result<Vec<ViewInfo>, AppError> {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
            .map_err(Self::query_err)?;

        let views: Vec<ViewInfo> = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                Ok(ViewInfo {
                    name,
                    schema: None,
                    definition: None,
                })
            })
            .map_err(Self::query_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(Self::query_err)?;

        Ok(views)
    }

    fn fetch_columns(
        conn: &Connection,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, AppError> {
        let pragma_sql = format!("PRAGMA table_info({})", table_name);
        let mut stmt = conn.prepare(&pragma_sql).map_err(Self::query_err)?;
        let col_iter = stmt
            .query_map([], |row| {
                let col_name: String = row.get(1)?;
                let col_type: String = row.get(2)?;
                let not_null: i32 = row.get(3)?;
                let default_val: Option<String> = row.get(4)?;
                let pk: i32 = row.get(5)?;
                Ok(ColumnInfo {
                    name: col_name,
                    data_type: col_type,
                    nullable: Some(not_null == 0),
                    default_value: default_val,
                    is_primary_key: pk > 0,
                })
            })
            .map_err(Self::query_err)?;

        col_iter
            .collect::<Result<Vec<_>, _>>()
            .map_err(Self::query_err)
    }

    fn fetch_table_indexes(
        conn: &Connection,
        table_name: &str,
    ) -> Result<Vec<IndexInfo>, AppError> {
        let pragma_sql = format!("PRAGMA index_list({})", table_name);
        let mut stmt = conn.prepare(&pragma_sql).map_err(Self::query_err)?;
        let idx_iter = stmt
            .query_map([], |row| {
                let name: String = row.get(1)?;
                let unique: i32 = row.get(2)?;
                let origin: String = row.get(3)?;
                Ok(IndexInfo {
                    name,
                    columns: vec![],
                    unique: unique == 1,
                    primary: origin.eq_ignore_ascii_case("pk"),
                })
            })
            .map_err(Self::query_err)?;

        idx_iter
            .collect::<Result<Vec<_>, _>>()
            .map_err(Self::query_err)
    }
}