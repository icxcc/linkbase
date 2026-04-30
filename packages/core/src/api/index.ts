import { invoke as tauriInvoke } from '@tauri-apps/api/core'

export interface ConnectionConfig {
  driver_type: string
  connection_string: string
  options?: Record<string, unknown>
}

export type ConnectionId = string

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface ColumnInfo {
  name: string
  data_type: string
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

export async function connect(config: ConnectionConfig): Promise<ConnectionId> {
  return invoke<ConnectionId>('connect', { config })
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

export async function cancelQuery(id: ConnectionId): Promise<void> {
  return invoke<void>('cancel_query', { id })
}

export interface Metadata {
  tables: { name: string; columns: { name: string; data_type: string }[] }[]
  databases?: string[]
  views?: string[]
  driver_type?: string
}

export async function getMetadata(id: ConnectionId): Promise<Metadata> {
  return invoke<Metadata>('get_metadata', { id })
}

export { extractErrorMessage }
