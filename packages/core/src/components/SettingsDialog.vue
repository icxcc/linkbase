<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, type Theme, type Locale } from '../stores/app'
import { useHistoryStore } from '../stores/history'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const { t } = useI18n()
const appStore = useAppStore()
const historyStore = useHistoryStore()

const activeTab = ref<'general' | 'editor' | 'result' | 'shortcuts' | 'about'>('general')

const themeOptions = computed(() => [
  { label: t('settings.themeLight'), value: 'light' as Theme },
  { label: t('settings.themeDark'), value: 'dark' as Theme },
  { label: t('settings.themeSystem'), value: 'system' as Theme },
])

const localeOptions = computed(() => [
  { label: '简体中文', value: 'zh-CN' as Locale },
  { label: 'English', value: 'en' as Locale },
])

const fontFamilyOptions = [
  { label: 'Cascadia Code', value: "'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace" },
  { label: 'Fira Code', value: "'Fira Code', 'Consolas', 'Monaco', monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', 'Consolas', 'Monaco', monospace" },
  { label: 'Consolas', value: "'Consolas', 'Monaco', monospace" },
  { label: 'Monaco', value: "'Monaco', monospace" },
  { label: 'System Mono', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
]

const shortcuts = computed(() => [
  { keys: 'Ctrl+Enter', description: t('editor.executeAll') },
  { keys: 'Ctrl+Shift+F', description: t('editor.format') },
  { keys: 'Ctrl+Shift+P', description: t('commandPalette.title') },
  { keys: 'Ctrl+S', description: t('settings.shortcutsSaveTab') },
])

function close() {
  emit('update:show', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.show" class="settings-overlay" @click.self="close">
      <div class="settings-dialog">
        <div class="settings-header">
          <h2>{{ t('settings.title') }}</h2>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <div class="settings-body">
          <nav class="settings-tabs">
            <button :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">
              {{ t('settings.tabGeneral') }}
            </button>
            <button :class="{ active: activeTab === 'editor' }" @click="activeTab = 'editor'">
              {{ t('settings.tabEditor') }}
            </button>
            <button :class="{ active: activeTab === 'result' }" @click="activeTab = 'result'">
              {{ t('settings.tabResult') }}
            </button>
            <button :class="{ active: activeTab === 'shortcuts' }" @click="activeTab = 'shortcuts'">
              {{ t('settings.tabShortcuts') }}
            </button>
            <button :class="{ active: activeTab === 'about' }" @click="activeTab = 'about'">
              {{ t('settings.tabAbout') }}
            </button>
          </nav>

          <div class="settings-content">
            <!-- General -->
            <div v-if="activeTab === 'general'" class="tab-content">
              <div class="form-item">
                <label>{{ t('settings.theme') }}</label>
                <select :value="appStore.theme" @change="appStore.setTheme(($event.target as HTMLSelectElement).value as Theme)">
                  <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="form-item">
                <label>{{ t('settings.language') }}</label>
                <select :value="appStore.locale" @change="appStore.setLocale(($event.target as HTMLSelectElement).value as Locale)">
                  <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>

            <!-- Editor -->
            <div v-if="activeTab === 'editor'" class="tab-content">
              <div class="form-item">
                <label>{{ t('settings.fontSize') }}</label>
                <input type="number" :value="appStore.editorPrefs.fontSize" min="10" max="28"
                  @change="appStore.setEditorPrefs({ fontSize: Number(($event.target as HTMLInputElement).value) })" />
              </div>
              <div class="form-item">
                <label>{{ t('settings.fontFamily') }}</label>
                <select :value="appStore.editorPrefs.fontFamily"
                  @change="appStore.setEditorPrefs({ fontFamily: ($event.target as HTMLSelectElement).value })">
                  <option v-for="opt in fontFamilyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="form-item">
                <label>{{ t('settings.tabSize') }}</label>
                <input type="number" :value="appStore.editorPrefs.tabSize" min="1" max="8"
                  @change="appStore.setEditorPrefs({ tabSize: Number(($event.target as HTMLInputElement).value) })" />
              </div>
              <div class="form-item">
                <label>{{ t('settings.wordWrap') }}</label>
                <input type="checkbox" :checked="appStore.editorPrefs.wordWrap"
                  @change="appStore.setEditorPrefs({ wordWrap: ($event.target as HTMLInputElement).checked })" />
              </div>
              <div class="form-item">
                <label>{{ t('settings.minimap') }}</label>
                <input type="checkbox" :checked="appStore.editorPrefs.minimap"
                  @change="appStore.setEditorPrefs({ minimap: ($event.target as HTMLInputElement).checked })" />
              </div>
              <div class="form-actions">
                <button class="btn-secondary" @click="appStore.resetEditorPrefs()">{{ t('settings.resetDefaults') }}</button>
              </div>
            </div>

            <!-- Result -->
            <div v-if="activeTab === 'result'" class="tab-content">
              <div class="form-item">
                <label>{{ t('settings.pageSize') }}</label>
                <input type="number" :value="appStore.resultPrefs.pageSize" min="100" max="100000" step="100"
                  @change="appStore.setResultPrefs({ pageSize: Number(($event.target as HTMLInputElement).value) })" />
              </div>
              <div class="form-item">
                <label>{{ t('settings.nullDisplay') }}</label>
                <input type="text" :value="appStore.resultPrefs.nullDisplay"
                  @change="appStore.setResultPrefs({ nullDisplay: ($event.target as HTMLInputElement).value })" />
              </div>
              <div class="form-item">
                <label>{{ t('settings.dateFormat') }}</label>
                <input type="text" :value="appStore.resultPrefs.dateFormat"
                  @change="appStore.setResultPrefs({ dateFormat: ($event.target as HTMLInputElement).value })" />
              </div>
              <div class="form-actions">
                <button class="btn-secondary" @click="appStore.resetResultPrefs()">{{ t('settings.resetDefaults') }}</button>
                <button class="btn-warning" @click="historyStore.clearHistory()">{{ t('settings.clearHistory') }}</button>
              </div>
            </div>

            <!-- Shortcuts -->
            <div v-if="activeTab === 'shortcuts'" class="tab-content">
              <div class="shortcut-list">
                <div v-for="sc in shortcuts" :key="sc.keys" class="shortcut-row">
                  <code class="shortcut-keys">{{ sc.keys }}</code>
                  <span class="shortcut-desc">{{ sc.description }}</span>
                </div>
              </div>
            </div>

            <!-- About -->
            <div v-if="activeTab === 'about'" class="tab-content">
              <div class="about-box">
                <h3>LinkBase</h3>
                <p>{{ t('settings.aboutDescription') }}</p>
                <p class="version">v0.1.0</p>
                <p><a href="https://github.com/icxcc/linkbase" target="_blank" rel="noopener">GitHub</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
}
.settings-dialog {
  background: var(--lb-bg-primary, #1e1e2e);
  border: 1px solid var(--lb-border-color, #333);
  border-radius: 8px; width: 680px; max-width: 90vw; max-height: 80vh;
  display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.settings-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--lb-border-color, #333);
}
.settings-header h2 { margin: 0; font-size: 16px; color: var(--lb-text-primary, #cdd6f4); }
.close-btn {
  background: none; border: none; font-size: 20px; cursor: pointer;
  color: var(--lb-text-secondary, #a6adc8); line-height: 1;
}
.close-btn:hover { color: var(--lb-text-primary, #cdd6f4); }
.settings-body { display: flex; flex: 1; overflow: hidden; }
.settings-tabs {
  display: flex; flex-direction: column; gap: 2px; padding: 12px 8px;
  border-right: 1px solid var(--lb-border-color, #333); min-width: 120px;
}
.settings-tabs button {
  background: none; border: none; padding: 8px 12px; border-radius: 4px;
  text-align: left; cursor: pointer; font-size: 13px;
  color: var(--lb-text-secondary, #a6adc8); transition: all 0.15s;
}
.settings-tabs button:hover { background: var(--lb-bg-secondary, #313244); }
.settings-tabs button.active {
  background: var(--lb-accent-color, #89b4fa); color: #1e1e2e; font-weight: 600;
}
.settings-content { flex: 1; padding: 16px 20px; overflow-y: auto; }
.tab-content { display: flex; flex-direction: column; gap: 14px; }
.form-item { display: flex; align-items: center; gap: 12px; }
.form-item label {
  min-width: 100px; font-size: 13px; color: var(--lb-text-primary, #cdd6f4);
}
.form-item select, .form-item input[type="text"], .form-item input[type="number"] {
  flex: 1; padding: 6px 10px; border-radius: 4px;
  border: 1px solid var(--lb-border-color, #333);
  background: var(--lb-bg-secondary, #313244);
  color: var(--lb-text-primary, #cdd6f4); font-size: 13px;
}
.form-item input[type="checkbox"] { width: 16px; height: 16px; }
.form-actions { display: flex; gap: 8px; margin-top: 8px; }
.btn-secondary {
  padding: 6px 12px; border-radius: 4px; border: 1px solid var(--lb-border-color, #333);
  background: var(--lb-bg-secondary, #313244); color: var(--lb-text-primary, #cdd6f4);
  font-size: 12px; cursor: pointer;
}
.btn-secondary:hover { background: var(--lb-border-color, #333); }
.btn-warning {
  padding: 6px 12px; border-radius: 4px; border: 1px solid #f38ba8;
  background: transparent; color: #f38ba8; font-size: 12px; cursor: pointer;
}
.btn-warning:hover { background: rgba(243, 139, 168, 0.1); }
.shortcut-list { display: flex; flex-direction: column; gap: 10px; }
.shortcut-row { display: flex; align-items: center; gap: 16px; }
.shortcut-keys {
  min-width: 140px; padding: 4px 8px; border-radius: 4px;
  background: var(--lb-bg-secondary, #313244); font-size: 12px;
  color: var(--lb-accent-color, #89b4fa);
}
.shortcut-desc { color: var(--lb-text-primary, #cdd6f4); font-size: 13px; }
.about-box { padding: 8px 0; }
.about-box h3 { margin: 0 0 8px; font-size: 18px; color: var(--lb-text-primary, #cdd6f4); }
.about-box p { margin: 6px 0; color: var(--lb-text-secondary, #a6adc8); font-size: 13px; }
.about-box .version { font-size: 12px; opacity: 0.7; }
.about-box a { color: var(--lb-accent-color, #89b4fa); text-decoration: none; }
.about-box a:hover { text-decoration: underline; }
</style>
