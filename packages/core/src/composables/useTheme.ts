import { watch, onMounted, onUnmounted } from 'vue'
import { useAppStore, type Theme } from '../stores/app'

function applyTheme(theme: Theme) {
  const root = document.documentElement

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export function useTheme() {
  const appStore = useAppStore()

  let mediaQuery: MediaQueryList | null = null
  let handler: (() => void) | null = null

  onMounted(() => {
    applyTheme(appStore.theme)

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    handler = () => {
      if (appStore.theme === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handler)
  })

  onUnmounted(() => {
    if (mediaQuery && handler) {
      mediaQuery.removeEventListener('change', handler)
    }
  })

  watch(
    () => appStore.theme,
    (theme) => {
      applyTheme(theme)
    },
  )
}
