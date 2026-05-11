<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert } from 'naive-ui'
import { LButton } from '@linkbase/components'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { useEditorStore } from '@linkbase/core/stores/editor'
import { useAppStore } from '@linkbase/core/stores/app'
import { useMonaco } from '../composables/useMonaco'
import EditorTabs from './EditorTabs.vue'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'execute', sql: string): void
}>()

const connectionStore = useConnectionStore()
const editorStore = useEditorStore()
const appStore = useAppStore()
const { initMonaco, getEditor, getMonaco, dispose } = useMonaco()

const editorContainer = useTemplateRef<HTMLElement>('editorContainer')
const editorTabsRef = useTemplateRef<InstanceType<typeof EditorTabs>>('editorTabs')
const editorReady = ref(false)

if (editorStore.tabs.length === 0) {
  const id = crypto.randomUUID()
  editorStore.addTab({ id, name: 'Query 1', sql: '' })
}

const activeTab = computed(() =>
  editorStore.tabs.find((t) => t.id === editorStore.activeTabId) ?? null
)

const activeConnectionName = computed(() => {
  const conn = connectionStore.connections.find((c) => c.id === connectionStore.currentConnectionId)
  return conn?.name ?? null
})

const dialect = computed(() => {
  const conn = connectionStore.connections.find((c) => c.id === connectionStore.currentConnectionId)
  if (!conn) return 'sql'
  return 'sql'
})

let isSettingValue = false

onMounted(async () => {
  await nextTick()
  if (!editorContainer.value) return

  const monaco = await getMonaco()
  const editor = await initMonaco(editorContainer.value, {
    value: activeTab.value?.sql ?? '',
    language: 'sql',
    fontSize: appStore.editorPrefs.fontSize,
    fontFamily: appStore.editorPrefs.fontFamily,
    tabSize: appStore.editorPrefs.tabSize,
    wordWrap: appStore.editorPrefs.wordWrap,
    minimap: appStore.editorPrefs.minimap,
  })
  editorReady.value = true

  if (editorStore.activeTabId) {
    editorTabsRef.value?.registerInitialSql(editorStore.activeTabId, activeTab.value?.sql ?? '')
  }

  editor.onDidChangeModelContent(() => {
    if (isSettingValue) return
    if (editorStore.activeTabId) {
      editorStore.updateTabSql(editorStore.activeTabId, editor.getValue())
    }
  })

  editor.addAction({
    id: 'execute-sql',
    label: 'Execute SQL',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => handleExecuteAll(),
  })

  editor.addAction({
    id: 'format-sql',
    label: 'Format SQL',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
    run: () => handleFormat(),
  })
})

watch(() => editorStore.activeTabId, async () => {
  await nextTick()
  const editor = getEditor()
  if (editor && activeTab.value) {
    isSettingValue = true
    editor.setValue(activeTab.value.sql)
    isSettingValue = false
    editor.setPosition({ lineNumber: 1, column: 1 })
    editorTabsRef.value?.registerInitialSql(activeTab.value.id, activeTab.value.sql)
  }
})

watch(dialect, async (lang) => {
  const editor = getEditor()
  const monaco = await getMonaco()
  if (editor) {
    monaco.editor.setModelLanguage(editor.getModel()!, lang)
  }
})

// Watch editor preferences and apply them live
watch(
  () => ({ ...appStore.editorPrefs }),
  (prefs) => {
    const editor = getEditor()
    if (!editor) return
    editor.updateOptions({
      fontSize: prefs.fontSize,
      fontFamily: prefs.fontFamily,
      tabSize: prefs.tabSize,
      wordWrap: prefs.wordWrap ? 'on' : 'off',
      minimap: { enabled: prefs.minimap },
    })
  },
  { deep: true },
)

function handleExecuteAll() {
  if (!activeConnectionName.value || !activeTab.value?.sql.trim()) return
  emit('execute', activeTab.value.sql.trim())
}

function handleExecuteSelection() {
  const editor = getEditor()
  if (!editor) return
  const selection = editor.getModel()!.getValueInRange(editor.getSelection()!)
  if (selection.trim()) {
    emit('execute', selection.trim())
  }
}

function handleExecuteStatement() {
  const editor = getEditor()
  if (!editor) return
  const statements = editor.getValue().split(';').map((s: string) => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    emit('execute', stmt)
  }
}

async function handleFormat() {
  const editor = getEditor()
  if (!editor) return
  try {
    const { format } = await import('sql-formatter')
    const formatted = format(editor.getValue(), {
      language: dialect.value === 'pgsql' ? 'postgresql' : (dialect.value as any),
    })
    isSettingValue = true
    editor.setValue(formatted)
    isSettingValue = false
  } catch {
    // sql-formatter not available, skip formatting
  }
}

function handleFill(e: Event) {
  const detail = (e as CustomEvent).detail as string
  if (!detail) return
  const editor = getEditor()
  if (editor) {
    isSettingValue = true
    editor.setValue(detail)
    isSettingValue = false
    if (editorStore.activeTabId) {
      editorStore.updateTabSql(editorStore.activeTabId, detail)
    }
  }
}

function handleExecuteRequest() {
  setTimeout(() => handleExecuteAll(), 50)
}

onMounted(() => {
  window.addEventListener('sql:fill', handleFill)
  window.addEventListener('sql:execute-request', handleExecuteRequest)
})

onUnmounted(() => {
  window.removeEventListener('sql:fill', handleFill)
  window.removeEventListener('sql:execute-request', handleExecuteRequest)
  dispose()
})
</script>

<template>
  <div class="sql-editor">
    <EditorTabs ref="editorTabs" />
    <div class="sql-editor-toolbar">
      <div class="sql-editor-connection">
        <span v-if="activeConnectionName" class="connection-name">{{ activeConnectionName }}</span>
        <span v-else class="connection-none">{{ t('editor.notConnected') }}</span>
      </div>
      <div class="sql-editor-actions">
        <LButton size="small" type="primary" :disabled="!activeConnectionName" @click="handleExecuteAll">
          {{ t('editor.executeAll') }}
        </LButton>
        <LButton size="small" :disabled="!activeConnectionName" @click="handleExecuteSelection">
          {{ t('editor.executeSelection') }}
        </LButton>
        <LButton size="small" :disabled="!activeConnectionName" @click="handleExecuteStatement">
          {{ t('editor.executeStatement') }}
        </LButton>
        <LButton size="small" @click="handleFormat">
          {{ t('editor.format') }}
        </LButton>
      </div>
    </div>

    <NAlert v-if="!activeConnectionName" type="warning" :show-icon="false" class="sql-editor-warning">
      {{ t('editor.needConnection') }}
    </NAlert>

    <div ref="editorContainer" class="monaco-container" />
  </div>
</template>

<style scoped>
.sql-editor { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.sql-editor-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; border-bottom: 1px solid var(--lb-border-color);
  background-color: var(--lb-bg-secondary); min-height: 34px;
}
.sql-editor-connection { font-size: 12px; color: var(--lb-text-secondary); }
.connection-name { color: var(--lb-accent-color); font-weight: 600; }
.connection-none { color: var(--lb-text-secondary); font-style: italic; }
.sql-editor-actions { display: flex; gap: 4px; }
.sql-editor-warning { margin: 0; border-radius: 0; border-left: none; border-right: none; }
.monaco-container { flex: 1; min-height: 0; }
</style>
