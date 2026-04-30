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
  getMetadata,
  type ConnectionConfig,
  type ConnectionId,
  type QueryResult,
  type AppError,
  type ColumnInfo,
  type RowData,
  type Metadata,
} from './api'

// Styles
import './styles/theme.css'
