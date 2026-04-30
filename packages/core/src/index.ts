// Stores
export {
  useAppStore,
  type Theme,
  type Locale,
} from './stores/app'

export {
  useConnectionStore,
  type Connection,
} from './stores/connection'

export {
  useEditorStore,
  type Tab,
} from './stores/editor'

export {
  useResultStore,
  type ResultSet,
  type LogEntry,
} from './stores/result'

export {
  useHistoryStore,
  type HistoryEntry,
} from './stores/history'

// Router
export { router } from './router'

// i18n
export { i18n } from './i18n'

// Composables
export { useTheme } from './composables/useTheme'

// API
export {
  connect,
  disconnect,
  executeSql,
  cancelQuery,
  getMetadata,
  testConnection,
  type ConnectionConfig,
  type ConnectionId,
  type ConnectionStatus,
  type QueryResult,
  type AppError,
  type ColumnInfo,
  type Metadata,
  type TestResult,
} from './api'

// Styles
import './styles/theme.css'
