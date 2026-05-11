use linkbase_core::{ConnectionManager, StoredConnection, StoredFolder, save_connections, load_connections_without_password, save_folders, load_folders};
use db_common::{AppError, ConnectionConfig, DatabaseMetadata, QueryChunk, QueryResult, TestResult};
use tauri::State;

#[tauri::command]
async fn connect(
    state: State<'_, ConnectionManager>,
    id: String,
) -> Result<(), AppError> {
    state.connect(&id).await
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
async fn execute_sql_streaming(
    state: State<'_, ConnectionManager>,
    id: String,
    sql: String,
    chunk_size: Option<usize>,
) -> Result<Vec<QueryChunk>, AppError> {
    let size = chunk_size.unwrap_or(1000);
    let mut receiver = state.execute_streaming(&id, &sql, size).await?;
    
    let mut chunks = Vec::new();
    while let Some(result) = receiver.recv().await {
        match result {
            Ok(chunk) => chunks.push(chunk),
            Err(e) => return Err(e),
        }
    }
    
    Ok(chunks)
}

#[tauri::command]
async fn get_metadata(
    state: State<'_, ConnectionManager>,
    id: String,
) -> Result<DatabaseMetadata, AppError> {
    state.get_metadata(&id).await
}

#[tauri::command]
async fn get_enhanced_metadata(
    state: State<'_, ConnectionManager>,
    id: String,
) -> Result<DatabaseMetadata, AppError> {
    state.get_enhanced_metadata(&id).await
}

#[tauri::command]
async fn cancel_query(
    state: State<'_, ConnectionManager>,
    id: String,
) -> Result<(), AppError> {
    state.cancel_query(&id).await
}

#[tauri::command]
async fn test_connection(
    state: State<'_, ConnectionManager>,
    config: ConnectionConfig,
) -> Result<TestResult, AppError> {
    state.test_connection(config).await
}

#[tauri::command]
async fn get_databases(
    state: State<'_, ConnectionManager>,
    id: String,
) -> Result<Vec<String>, AppError> {
    state.get_databases(&id).await
}

#[tauri::command]
async fn get_schemas(
    state: State<'_, ConnectionManager>,
    id: String,
    database: Option<String>,
) -> Result<Vec<String>, AppError> {
    state.get_schemas(&id, database.as_deref()).await
}

#[tauri::command]
async fn switch_database(
    state: State<'_, ConnectionManager>,
    id: String,
    database: String,
) -> Result<(), AppError> {
    state.switch_database(&id, &database).await
}

#[tauri::command]
async fn save_connections_cmd(connections: Vec<StoredConnection>) -> Result<(), AppError> {
    save_connections(connections)
}

#[tauri::command]
async fn load_connections_cmd() -> Result<Vec<StoredConnection>, AppError> {
    load_connections_without_password()
}

#[tauri::command]
async fn save_folders_cmd(folders: Vec<StoredFolder>) -> Result<(), AppError> {
    save_folders(folders)
}

#[tauri::command]
async fn load_folders_cmd() -> Result<Vec<StoredFolder>, AppError> {
    load_folders()
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
            execute_sql_streaming,
            get_metadata,
            get_enhanced_metadata,
            get_databases,
            get_schemas,
            switch_database,
            cancel_query,
            test_connection,
            save_connections_cmd,
            load_connections_cmd,
            save_folders_cmd,
            load_folders_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
