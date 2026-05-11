// Stores
export {
  useAppStore,
  type Theme,
  type Locale,
  type EditorPreferences,
  type ResultPreferences,
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

// Components
export { default as SettingsDialog } from './components/SettingsDialog.vue'
export { default as CommandPalette } from './components/CommandPalette.vue'
export { default as DangerousSqlDialog } from './components/DangerousSqlDialog.vue'

// API
export {
  connect,
  disconnect,
  executeSql,
  cancelQuery,
  getMetadata,
  getEnhancedMetadata,
  testConnection,
  type ConnectionConfig,
  type ConnectionId,
  type ConnectionStatus,
  type QueryResult,
  type AppError,
  type ColumnInfo,
  type TableInfo,
  type ViewInfo,
  type RoutineInfo,
  type SequenceInfo,
  type IndexInfo,
  type ConstraintInfo,
  type UserInfo,
  type DatabaseInfo,
  type SchemaInfo,
  type DatabaseMetadata,
  type TestResult,
  type DriverType,
} from './api'

// Styles
import './styles/theme.css'
