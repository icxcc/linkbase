use async_trait::async_trait;
use db_common::{
    AppError, ColumnInfo, ConnectionConfig, DatabaseMetadata, DbDriver, QueryResult, TableInfo,
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
        let path = config.connection_string.clone();
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

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .map_err(Self::query_err)?;

        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(Self::query_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(Self::query_err)?;

        let mut tables = Vec::new();
        for name in table_names {
            let pragma_sql = format!("PRAGMA table_info({})", name);
            let mut stmt = conn.prepare(&pragma_sql).map_err(Self::query_err)?;
            let col_iter = stmt
                .query_map([], |row| {
                    let col_name: String = row.get(1)?;
                    let col_type: String = row.get(2)?;
                    Ok(ColumnInfo {
                        name: col_name,
                        data_type: col_type,
                    })
                })
                .map_err(Self::query_err)?;

            let columns: Vec<ColumnInfo> = col_iter
                .collect::<Result<Vec<_>, _>>()
                .map_err(Self::query_err)?;

            tables.push(TableInfo { name, columns });
        }

        Ok(DatabaseMetadata { tables })
    }
}
