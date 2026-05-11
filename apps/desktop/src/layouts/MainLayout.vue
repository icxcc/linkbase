<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NIcon } from 'naive-ui'
import { SettingsOutline, SunnyOutline, MoonOutline, RemoveOutline, SquareOutline, CloseOutline, ServerOutline } from '@vicons/ionicons5'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAppStore } from '@linkbase/core/stores/app'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { useEditorStore } from '@linkbase/core/stores/editor'
import { useResultStore } from '@linkbase/core/stores/result'
import { useHistoryStore } from '@linkbase/core/stores/history'
import { executeSql, type ColumnInfo } from '@linkbase/core/api'
import { ConnectionTree, ConnectionDialog } from '@linkbase/connection'
import { type Connection } from '@linkbase/core/stores/connection'
import SqlEditor from '@linkbase/editor/components/SqlEditor.vue'
import ResultPanel from '@linkbase/result/components/ResultPanel.vue'

const { t } = useI18n()
const appStore = useAppStore()
const connectionStore = useConnectionStore()
const resultStore = useResultStore()

let appWindow: ReturnType<typeof getCurrentWindow> | null = null
try {
  appWindow = getCurrentWindow()
} catch { /* not in Tauri context */ }

const currentConnection = computed<string | null>({
  get: () => connectionStore.currentConnectionId,
  set: (val) => connectionStore.setCurrentConnection(val),
})

const connectionOptions = computed(() =>
  connectionStore.connections.map((c: Connection) => ({ label: c.name, value: c.id })),
)

const isDark = computed(() => appStore.theme === 'dark')

const statusText = computed(() => {
  if (resultStore.loading) return t('status.executing')
  if (resultStore.error) return t('status.error')
  return t('status.ready')
})

const statusMeta = computed(() => {
  const rowCount = resultStore.results[0]?.rows?.length ?? 0
  const affected = resultStore.lastAffectedRows
  const time = resultStore.lastExecutionTime ?? 0
  if (affected !== undefined && rowCount === 0) return t('status.rowsAffected', { n: affected }) + ` | ${time}ms`
  return t('status.rowsCount', { n: rowCount }) + ` | ${time}ms`
})

function toggleTheme() {
  appStore.setTheme(isDark.value ? 'light' : 'dark')
}

function toggleLocale() {
  appStore.setLocale(appStore.locale === 'zh-CN' ? 'en' : 'zh-CN')
}

const showCreateDialog = ref(false)
const editingConnectionId = ref<string | undefined>(undefined)

async function handleExecute(sql: string) {
  const editorStore = useEditorStore()
  const activeTab = editorStore.tabs.find((t) => t.id === editorStore.activeTabId)
  const connectionId = activeTab?.session?.connectionId ?? connectionStore.currentConnectionId
  if (!connectionId) return

  const database = activeTab?.session?.database ?? undefined

  resultStore.setLoading(true)
  resultStore.setError(null)

  try {
    const res = await executeSql(connectionId, sql, database)
    const columns = res.columns.map((col: ColumnInfo) => col.name)
    resultStore.setResults([{
      id: crypto.randomUUID?.() ?? String(Date.now()),
      columns,
      rows: res.rows,
      executionTime: res.execution_time,
    }])
    resultStore.setExecutionMeta(res.execution_time, res.affected_rows)
    const msg = res.columns.length > 0
      ? t('status.queryComplete', { n: res.row_count, t: res.execution_time.toFixed(1) })
      : t('status.execSuccess', { n: res.affected_rows ?? 0, t: res.execution_time.toFixed(1) })
    resultStore.addLog({ message: msg, level: 'success' })
    useHistoryStore().addEntry(sql, currentConnectionName.value)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    resultStore.setError(message)
    resultStore.addLog({ message, level: 'error' })
  } finally {
    resultStore.setLoading(false)
  }
}

function handleConnectionChanged(id: string | null) {
  connectionStore.setCurrentConnection(id)
}

const currentConnectionName = computed(() =>
  connectionStore.connections.find((c: Connection) => c.id === currentConnection.value)?.name ?? t('status.noConnection'),
)

const resultColumns = computed(() =>
  (resultStore.results[0]?.columns ?? []) as string[],
)

const resultData = computed(() =>
  (resultStore.results[0]?.rows ?? []) as unknown[][],
)

function minimizeWindow() { appWindow?.minimize() }
function maximizeWindow() { appWindow?.toggleMaximize() }
function closeWindow() { appWindow?.close() }

const sidebarWidth = ref(250)
const isResizingHorizontal = ref(false)

function startResizeHorizontal(e: MouseEvent) {
  isResizingHorizontal.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  function onMouseMove(ev: MouseEvent) {
    sidebarWidth.value = Math.max(180, Math.min(400, startWidth + (ev.clientX - startX)))
  }
  function onMouseUp() {
    isResizingHorizontal.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const editorHeight = ref(60)
const isResizingVertical = ref(false)

function startResizeVertical(e: MouseEvent) {
  isResizingVertical.value = true
  const startY = e.clientY
  const container = (e.target as HTMLElement).parentElement?.parentElement
  if (!container) return
  const containerHeight = container.clientHeight
  const startPercent = editorHeight.value
  function onMouseMove(ev: MouseEvent) {
    const deltaPercent = ((ev.clientY - startY) / containerHeight) * 100
    editorHeight.value = Math.max(20, Math.min(80, startPercent + deltaPercent))
  }
  function onMouseUp() {
    isResizingVertical.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div class="main-layout">
    <div class="titlebar" data-tauri-drag-region>
      <div class="titlebar-left">
        <NIcon size="18" :depth="1"><ServerOutline /></NIcon>
        <span class="titlebar-title">Linkbase</span>
      </div>
      <div class="titlebar-center" data-tauri-drag-region />
      <div class="titlebar-actions">
        <button class="titlebar-btn" :title="$t('titlebar.settings')">
          <NIcon size="16"><SettingsOutline /></NIcon>
        </button>
        <button class="titlebar-btn" :title="$t('titlebar.toggleTheme')" @click="toggleTheme">
          <NIcon size="16">
            <SunnyOutline v-if="isDark" />
            <MoonOutline v-else />
          </NIcon>
        </button>
        <button class="titlebar-btn" :title="$t('titlebar.toggleLocale')" @click="toggleLocale" style="width:auto;padding:0 6px;font-size:11px;">
          {{ appStore.locale === 'zh-CN' ? 'EN' : '中' }}
        </button>
        <div class="titlebar-spacer" />
        <button class="titlebar-btn" @click="minimizeWindow">
          <NIcon size="16"><RemoveOutline /></NIcon>
        </button>
        <button class="titlebar-btn" @click="maximizeWindow">
          <NIcon size="16"><SquareOutline /></NIcon>
        </button>
        <button class="titlebar-btn win-close" @click="closeWindow">
          <NIcon size="16"><CloseOutline /></NIcon>
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <NSelect
          v-model:value="currentConnection"
          :options="connectionOptions"
          :placeholder="$t('toolbar.selectConnection')"
          size="small"
          style="width: 220px"
          @update:value="handleConnectionChanged"
        />
      </div>
    </div>

    <div class="main-content">
      <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
        <ConnectionTree
          @open-create-dialog="showCreateDialog = true"
          @open-edit-dialog="(id) => { editingConnectionId = id; showCreateDialog = true }"
          @execute-sql="handleExecute"
        />
      </div>

      <div
        class="splitter splitter-horizontal"
        :class="{ resizing: isResizingHorizontal }"
        @mousedown="startResizeHorizontal"
      />

      <div class="main-area">
        <div class="editor-area" :style="{ height: editorHeight + '%' }">
          <SqlEditor @execute="handleExecute" />
        </div>

        <div
          class="splitter splitter-vertical"
          :class="{ resizing: isResizingVertical }"
          @mousedown="startResizeVertical"
        />

        <div class="result-area" :style="{ height: (100 - editorHeight) + '%' }">
          <ResultPanel
            :columns="resultColumns"
            :data="resultData"
            :loading="resultStore.loading"
            :error="resultStore.error"
            :execution-time="resultStore.lastExecutionTime"
            :affected-rows="resultStore.lastAffectedRows"
          />
        </div>
      </div>
    </div>

    <div class="status-bar">
      <div class="status-left">
        <span class="status-connection">{{ currentConnectionName }}</span>
      </div>
      <div class="status-center">
        <span class="status-text">{{ statusText }}</span>
      </div>
      <div class="status-right">
        <span class="status-meta">{{ statusMeta }}</span>
      </div>
    </div>

    <ConnectionDialog
      :visible="showCreateDialog"
      :connection-id="editingConnectionId"
      @close="() => { showCreateDialog = false; editingConnectionId = undefined }"
    />
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--lb-bg-primary);
  color: var(--lb-text-primary);
}
.titlebar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px;
  background-color: var(--lb-bg-secondary);
  border-bottom: 1px solid var(--lb-border-color);
  user-select: none;
}
.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px;
  min-width: 120px;
  color: var(--lb-accent-color);
}
.titlebar-title { font-size: 13px; font-weight: 600; color: var(--lb-text-primary); }
.titlebar-center { flex: 1; -webkit-app-region: drag; height: 100%; }
.titlebar-actions { display: flex; align-items: center; gap: 2px; }
.titlebar-spacer { width: 8px; }
.titlebar-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 26px; border: none; border-radius: 4px;
  background: transparent; color: var(--lb-text-secondary);
  cursor: pointer; transition: background-color 0.15s, color 0.15s;
}
.titlebar-btn:hover { background-color: var(--lb-hover-bg); color: var(--lb-text-primary); }
.titlebar-btn.win-close:hover { background-color: #e81123; color: #fff; }
.toolbar {
  display: flex; align-items: center; justify-content: space-between;
  height: 40px; padding: 0 12px; background-color: var(--lb-bg-tertiary);
  border-bottom: 1px solid var(--lb-border-color); gap: 12px;
}
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.main-content { display: flex; flex: 1; overflow: hidden; }
.sidebar {
  flex-shrink: 0; display: flex; flex-direction: column;
  background-color: var(--lb-bg-secondary); border-right: 1px solid var(--lb-border-color); overflow: hidden;
}
.main-area { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.editor-area { background-color: var(--lb-bg-primary); overflow: hidden; }
.result-area { background-color: var(--lb-bg-primary); overflow: hidden; }
.splitter { flex-shrink: 0; background-color: var(--lb-border-color); transition: background-color 0.2s; }
.splitter-horizontal { width: 3px; cursor: col-resize; }
.splitter-vertical { height: 3px; cursor: row-resize; }
.splitter:hover, .splitter.resizing { background-color: var(--lb-accent-color); }
.status-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 26px; padding: 0 12px; background-color: var(--lb-bg-secondary);
  border-top: 1px solid var(--lb-border-color); font-size: 12px; color: var(--lb-text-secondary); user-select: none;
}
.status-left, .status-center, .status-right { display: flex; align-items: center; gap: 8px; }
</style>
