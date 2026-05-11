import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type Locale = 'zh-CN' | 'en'

export interface EditorPreferences {
  fontSize: number
  fontFamily: string
  tabSize: number
  wordWrap: boolean
  minimap: boolean
}

export interface ResultPreferences {
  pageSize: number
  nullDisplay: string
  dateFormat: string
}

const THEME_KEY = 'linkbase-theme'
const LOCALE_KEY = 'linkbase-locale'
const EDITOR_PREFS_KEY = 'linkbase-editor-prefs'
const RESULT_PREFS_KEY = 'linkbase-result-prefs'

const DEFAULT_EDITOR_PREFS: EditorPreferences = {
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace",
  tabSize: 2,
  wordWrap: false,
  minimap: false,
}

const DEFAULT_RESULT_PREFS: ResultPreferences = {
  pageSize: 1000,
  nullDisplay: '(NULL)',
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // ignore
  }
  return defaultValue
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota exceeded
  }
}

export const useAppStore = defineStore('app', () => {
  const theme = ref<Theme>(loadFromStorage<Theme>(THEME_KEY, 'system'))
  const locale = ref<Locale>(loadFromStorage<Locale>(LOCALE_KEY, 'zh-CN'))
  const sidebarCollapsed = ref(false)

  const editorPrefs = ref<EditorPreferences>({
    ...DEFAULT_EDITOR_PREFS,
    ...loadFromStorage<Partial<EditorPreferences>>(EDITOR_PREFS_KEY, {}),
  })

  const resultPrefs = ref<ResultPreferences>({
    ...DEFAULT_RESULT_PREFS,
    ...loadFromStorage<Partial<ResultPreferences>>(RESULT_PREFS_KEY, {}),
  })

  watch(editorPrefs, (val) => saveToStorage(EDITOR_PREFS_KEY, val), { deep: true })
  watch(resultPrefs, (val) => saveToStorage(RESULT_PREFS_KEY, val), { deep: true })

  function setTheme(value: Theme) {
    theme.value = value
    localStorage.setItem(THEME_KEY, JSON.stringify(value))
  }

  function setLocale(value: Locale) {
    locale.value = value
    localStorage.setItem(LOCALE_KEY, JSON.stringify(value))
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setEditorPrefs(prefs: Partial<EditorPreferences>) {
    editorPrefs.value = { ...editorPrefs.value, ...prefs }
  }

  function setResultPrefs(prefs: Partial<ResultPreferences>) {
    resultPrefs.value = { ...resultPrefs.value, ...prefs }
  }

  function resetEditorPrefs() {
    editorPrefs.value = { ...DEFAULT_EDITOR_PREFS }
  }

  function resetResultPrefs() {
    resultPrefs.value = { ...DEFAULT_RESULT_PREFS }
  }

  function initialize() {
    const root = document.documentElement
    if (theme.value === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      root.setAttribute('data-theme', theme.value)
    }
  }

  return {
    theme,
    locale,
    sidebarCollapsed,
    editorPrefs,
    resultPrefs,
    setTheme,
    setLocale,
    toggleSidebar,
    setEditorPrefs,
    setResultPrefs,
    resetEditorPrefs,
    resetResultPrefs,
    initialize,
  }
})
