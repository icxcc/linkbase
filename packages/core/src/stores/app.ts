import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type Locale = 'zh-CN' | 'en'

const THEME_KEY = 'linkbase-theme'
const LOCALE_KEY = 'linkbase-locale'

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // ignore
  }
  return defaultValue
}

export const useAppStore = defineStore('app', () => {
  const theme = ref<Theme>(loadFromStorage<Theme>(THEME_KEY, 'system'))
  const locale = ref<Locale>(loadFromStorage<Locale>(LOCALE_KEY, 'zh-CN'))
  const sidebarCollapsed = ref(false)

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
    setTheme,
    setLocale,
    toggleSidebar,
    initialize,
  }
})
