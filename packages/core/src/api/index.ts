import { invoke as tauriInvoke } from '@tauri-apps/api/core'

export type DriverType = 'sqlite' | 'mysql' | 'postgres' | 'oracle'

export interface ConnectionConfig {
  driver_type: string
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  connection_string?: string
  options?: Record<string, unknown>
}

export type ConnectionId = string

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface ColumnInfo {
  name: string
  data_type: string
  nullable?: boolean
  default_value?: string
  is_primary_key?: boolean
}

export interface QueryResult {
  columns: ColumnInfo[]
  rows: unknown[][]
  row_count: number
  execution_time: number
  affected_rows?: number
}

export interface AppError {
  code: string
  message: string
  detail?: string
  suggestion?: string
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
  }
  return String(error)
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    return tauriInvoke<T>(cmd, args)
}

export async function connect(configOrId: ConnectionConfig | ConnectionId): Promise<ConnectionId> {
    return invoke<ConnectionId>('connect', { configOrId })
}

export async function disconnect(id: ConnectionId): Promise<void> {
  return invoke<void>('disconnect', { id })
}

export interface TestResult {
  success: boolean
  latency_ms: number
  server_version: string
  ssl_status: string
  driver_info: string
}

export async function testConnection(config: ConnectionConfig): Promise<TestResult> {
  return invoke<TestResult>('test_connection', { config })
}

export async function executeSql(id: ConnectionId, sql: string): Promise<QueryResult> {
    return invoke<QueryResult>('execute_sql', { id, sql })
}

export interface QueryChunk {
    columns: ColumnInfo[]
    rows: Value[][]
    total_rows: number
    chunk_index: number
    is_last: boolean
    execution_time: number
}

export async function executeSqlStreaming(
    id: ConnectionId,
    sql: string,
    chunkSize?: number
): Promise<QueryChunk[]> {
    return invoke<QueryChunk[]>('execute_sql_streaming', { id, sql, chunk_size: chunkSize })
}

export async function cancelQuery(id: ConnectionId): Promise<void> {
  return invoke<void>('cancel_query', { id })
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
  primary: boolean
}

export interface ConstraintInfo {
  name: string
  constraint_type: string
  columns: string[]
}

export interface TableInfo {
  name: string
  schema?: string
  columns: ColumnInfo[]
  indexes?: IndexInfo[]
  constraints?: ConstraintInfo[]
}

export interface ViewInfo {
  name: string
  schema?: string
  definition?: string
}

export interface RoutineInfo {
  name: string
  routine_type: string
  return_type?: string
}

export interface SequenceInfo {
  name: string
}

export interface UserInfo {
  name: string
  host?: string
}

export interface TriggerInfo {
  name: string
  table_name?: string
  timing?: string
  event?: string
  definition?: string
}

export interface EventInfo {
  name: string
  schedule?: string
  enabled?: boolean
  definition?: string
}

export interface RoleInfo {
  name: string
  description?: string
}

export interface TablespaceInfo {
  name: string
  location?: string
}

export interface DatabaseInfo {
  name: string
  tables?: TableInfo[]
  views?: ViewInfo[]
  functions?: RoutineInfo[]
  procedures?: RoutineInfo[]
  users?: UserInfo[]
  triggers?: TriggerInfo[]
  events?: EventInfo[]
  roles?: RoleInfo[]
  tablespaces?: TablespaceInfo[]
  schemas?: SchemaInfo[]
}

export interface SchemaInfo {
  name: string
  tables?: TableInfo[]
  views?: ViewInfo[]
  materialized_views?: ViewInfo[]
  functions?: RoutineInfo[]
  procedures?: RoutineInfo[]
  sequences?: SequenceInfo[]
  indexes?: IndexInfo[]
  triggers?: TriggerInfo[]
  events?: EventInfo[]
}

export interface DatabaseMetadata {
  driver_type: string
  databases?: DatabaseInfo[]
  schemas?: SchemaInfo[]
  tables?: TableInfo[]
  roles?: RoleInfo[]
  tablespaces?: TablespaceInfo[]
  users?: UserInfo[]
}

export async function getMetadata(id: ConnectionId): Promise<DatabaseMetadata> {
  return invoke<DatabaseMetadata>('get_metadata', { id })
}

export async function getEnhancedMetadata(id: ConnectionId): Promise<DatabaseMetadata> {
  return invoke<DatabaseMetadata>('get_enhanced_metadata', { id })
}

export interface StoredConnection {
  id: string
  name: string
  host?: string
  port?: number
  user?: string
  database?: string
  username?: string
  driver_type: string
  connection_string?: string
  options?: Record<string, unknown>
  folder_id?: string
  password?: string
}

export interface StoredFolder {
  id: string
  name: string
}

export async function saveConnections(connections: StoredConnection[]): Promise<void> {
  return invoke('save_connections_cmd', { connections })
}

export async function loadConnections(): Promise<StoredConnection[]> {
  return invoke<StoredConnection[]>('load_connections_cmd')
}

export async function saveFolders(folders: StoredFolder[]): Promise<void> {
  return invoke('save_folders_cmd', { folders })
}

export async function loadFolders(): Promise<StoredFolder[]> {
  return invoke<StoredFolder[]>('load_folders_cmd')
}

export { extractErrorMessage }
