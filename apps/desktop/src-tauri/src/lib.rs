use linkbase_core::ConnectionManager;
use db_common::{AppError, ConnectionConfig, DatabaseMetadata, QueryResult};
use tauri::State;

#[tauri::command]
async fn connect(
    state: State<'_, ConnectionManager>,
    config: ConnectionConfig,
) -> Result<String, AppError> {
    state.connect(config).await
}

#[tauri::command]
async fn disconnect(
    state: State<'_, ConnectionManager>,
    id: String,
) -> Result<(), AppError> {
    state.disconnect(&id).await
}

#[tauri::command]
async fn execute_sql(
    state: State<'_, ConnectionManager>,
    id: String,
    sql: String,
) -> Result<QueryResult, AppError> {
    state.execute(&id, &sql).await
}

#[tauri::command]
async fn get_metadata(
    state: State<'_, ConnectionManager>,
    id: String,
) -> Result<DatabaseMetadata, AppError> {
    state.get_metadata(&id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let connection_manager = ConnectionManager::new();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(connection_manager)
        .invoke_handler(tauri::generate_handler![
            connect,
            disconnect,
            execute_sql,
            get_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
