import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@linkbase/core/router'
import { useAppStore } from '@linkbase/core/stores/app'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { i18n } from '@linkbase/core/i18n'
import '@linkbase/core/styles/theme.css'
import './styles/main.css'
import App from './App.vue'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(i18n)

app.mount('#app')

const appStore = useAppStore()
appStore.initialize()

const connectionStore = useConnectionStore()
connectionStore.loadFromBackend()
