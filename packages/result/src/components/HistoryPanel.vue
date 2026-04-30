<script setup lang="ts">
import { computed } from 'vue'
import { NInput, NIcon, NButton, NPopconfirm, NScrollbar, NEmpty } from 'naive-ui'
import { SearchOutline, Star, StarOutline, TrashOutline } from '@vicons/ionicons5'
import { useHistoryStore } from '@linkbase/core/stores/history'
import { useEditorStore } from '@linkbase/core/stores/editor'

const historyStore = useHistoryStore()
const editorStore = useEditorStore()

function fillSql(sql: string) {
  if (editorStore.activeTabId) {
    editorStore.updateTabSql(editorStore.activeTabId, sql)
  }
  window.dispatchEvent(new CustomEvent('sql:fill', { detail: sql }))
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function truncate(sql: string, max = 80): string {
  return sql.length > max ? sql.substring(0, max).replace(/\n/g, ' ') + '...' : sql.replace(/\n/g, ' ')
}

const displayEntries = computed(() => historyStore.sortedEntries)
</script>

<template>
  <div class="history-panel">
    <div class="history-header">
      <span class="history-title">查询历史</span>
      <NPopconfirm @positive-click="historyStore.clearHistory()">
        <template #trigger><NButton size="tiny" quaternary>清空</NButton></template>
        确认清空所有查询历史？
      </NPopconfirm>
    </div>
    <div class="history-search">
      <NInput
        :value="historyStore.searchQuery"
        @update:value="historyStore.setSearchQuery"
        size="small"
        placeholder="搜索历史..."
        clearable
      >
        <template #prefix><NIcon size="14"><SearchOutline /></NIcon></template>
      </NInput>
    </div>
    <NScrollbar v-if="displayEntries.length > 0" class="history-list">
      <div
        v-for="entry in displayEntries"
        :key="entry.id"
        class="history-item"
        :class="{ 'history-item--favorited': entry.favorited }"
        @click="fillSql(entry.sql)"
      >
        <div class="history-item-top">
          <span class="history-sql">{{ truncate(entry.sql) }}</span>
          <NButton
            size="tiny"
            quaternary
            @click.stop="historyStore.toggleFavorite(entry.id)"
          >
            <template #icon>
              <NIcon size="14" :color="entry.favorited ? '#f0a020' : undefined">
                <Star v-if="entry.favorited" /><StarOutline v-else />
              </NIcon>
            </template>
          </NButton>
        </div>
        <div class="history-item-meta">
          <span>{{ entry.connectionName }}</span>
          <span>{{ formatTimestamp(entry.timestamp) }}</span>
        </div>
        <div v-if="entry.note" class="history-item-note">{{ entry.note }}</div>
        <div class="history-item-actions">
          <NButton size="tiny" quaternary @click.stop="historyStore.removeEntry(entry.id)">
            <template #icon><NIcon size="12"><TrashOutline /></NIcon></template>
          </NButton>
        </div>
      </div>
    </NScrollbar>
    <NEmpty v-else description="暂无查询历史" class="history-empty" />
  </div>
</template>

<style scoped>
.history-panel { display: flex; flex-direction: column; height: 100%; }
.history-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; }
.history-title { font-size: 11px; font-weight: 600; color: var(--lb-text-secondary); text-transform: uppercase; }
.history-search { padding: 4px 8px; }
.history-list { flex: 1; padding: 0 4px; }
.history-item { padding: 6px 8px; cursor: pointer; border-radius: 4px; position: relative; }
.history-item:hover { background: var(--lb-hover-bg); }
.history-item--favorited { border-left: 2px solid #f0a020; }
.history-item-top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.history-sql { font-family: monospace; font-size: 12px; color: var(--lb-text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-item-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--lb-text-secondary); margin-top: 2px; }
.history-item-note { font-size: 10px; color: var(--lb-accent-color); font-style: italic; margin-top: 2px; }
.history-item-actions { position: absolute; right: 4px; top: 4px; opacity: 0; }
.history-item:hover .history-item-actions { opacity: 1; }
.history-empty { margin-top: 24px; }
</style>
