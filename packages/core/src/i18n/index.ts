import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'

const savedLocale = (() => { try { return localStorage.getItem('linkbase-locale'); } catch { return null; } })()
const defaultLocale = savedLocale ? JSON.parse(savedLocale) : 'zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

export default i18n
