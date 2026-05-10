use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    AeadCore, Aes256Gcm, Nonce,
};
use base64::Engine;
use db_common::AppError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredConnection {
    pub id: String,
    pub name: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub user: Option<String>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub driver_type: String,
    pub connection_string: Option<String>,
    pub options: Option<serde_json::Value>,
    pub folder_id: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredFolder {
    pub id: String,
    pub name: String,
}

const CONNECTIONS_FILE: &str = "connections.json";
const FOLDERS_FILE: &str = "folders.json";
const ENCRYPTION_KEY: &[u8; 32] = b"LinkBaseSecret256bit__32byteKey!";

fn get_storage_path(filename: &str) -> Result<PathBuf, AppError> {
    let mut path = dirs::data_dir()
        .ok_or_else(|| AppError::other("无法获取数据目录"))?;
    path.push("linkbase");
    std::fs::create_dir_all(&path).map_err(|e| AppError::other(e.to_string()))?;
    path.push(filename);
    Ok(path)
}

fn encrypt(data: &str) -> Result<String, AppError> {
    let cipher = Aes256Gcm::new_from_slice(ENCRYPTION_KEY)
        .map_err(|e| AppError::other(e.to_string()))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, data.as_bytes())
        .map_err(|e| AppError::other(e.to_string()))?;

    let mut result = Vec::with_capacity(nonce.len() + ciphertext.len());
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);

    Ok(base64::engine::general_purpose::STANDARD.encode(&result))
}

fn decrypt(encrypted: &str) -> Result<String, AppError> {
    let data = base64::engine::general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| AppError::other(e.to_string()))?;

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(ENCRYPTION_KEY)
        .map_err(|e| AppError::other(e.to_string()))?;
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::other(e.to_string()))?;

    String::from_utf8(plaintext).map_err(|e| AppError::other(e.to_string()))
}

pub fn save_connections(connections: Vec<StoredConnection>) -> Result<(), AppError> {
    let path = get_storage_path(CONNECTIONS_FILE)?;

    let mut encrypted_conns = Vec::new();
    for mut conn in connections {
        if let Some(password) = conn.password.take() {
            conn.password = Some(encrypt(&password)?);
        }
        encrypted_conns.push(conn);
    }

    let content = serde_json::to_string(&encrypted_conns)
        .map_err(|e| AppError::other(e.to_string()))?;

    std::fs::write(&path, content).map_err(|e| AppError::other(e.to_string()))
}

pub fn load_connections() -> Result<Vec<StoredConnection>, AppError> {
    let path = get_storage_path(CONNECTIONS_FILE)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::other(e.to_string()))?;

    let mut connections: Vec<StoredConnection> = serde_json::from_str(&content)
        .map_err(|e| AppError::other(e.to_string()))?;

    for conn in &mut connections {
        if let Some(encrypted_password) = conn.password.as_ref() {
            conn.password = Some(decrypt(encrypted_password)?);
        }
    }

    Ok(connections)
}

/// 加载连接，但不返回密码字段（用于前端）
pub fn load_connections_without_password() -> Result<Vec<StoredConnection>, AppError> {
    let mut connections = load_connections()?;
    for conn in &mut connections {
        conn.password = None;
    }
    Ok(connections)
}

/// 通过 ID 获取单个连接（包含密码）
pub fn get_connection_by_id(id: &str) -> Result<StoredConnection, AppError> {
    let connections = load_connections()?;
    connections.into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::not_found(format!("连接 {} 不存在", id)))
}

pub fn save_folders(folders: Vec<StoredFolder>) -> Result<(), AppError> {
    let path = get_storage_path(FOLDERS_FILE)?;

    let content = serde_json::to_string(&folders)
        .map_err(|e| AppError::other(e.to_string()))?;

    std::fs::write(&path, content).map_err(|e| AppError::other(e.to_string()))
}

pub fn load_folders() -> Result<Vec<StoredFolder>, AppError> {
    let path = get_storage_path(FOLDERS_FILE)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::other(e.to_string()))?;

    let folders: Vec<StoredFolder> = serde_json::from_str(&content)
        .map_err(|e| AppError::other(e.to_string()))?;

    Ok(folders)
}
