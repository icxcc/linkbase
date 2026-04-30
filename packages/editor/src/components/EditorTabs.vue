<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { useEditorStore } from '@linkbase/core/stores/editor'

const editorStore = useEditorStore()

const editingTabId = ref<string | null>(null)
const editName = ref('')
const editInputRef = ref<HTMLInputElement>()

const initialSqlMap = reactive<Record<string, string>>({})

function isTabDirty(id: string): boolean {
  const tab = editorStore.tabs.find((t) => t.id === id)
  if (!tab) return false
  return tab.sql !== (initialSqlMap[id] ?? '')
}

function handleNewTab() {
  const n = editorStore.tabs.length + 1
  const id = crypto.randomUUID()
  const tab = { id, name: `Query ${n}`, sql: '' }
  editorStore.addTab(tab)
  initialSqlMap[id] = ''
}

function handleSelectTab(id: string) {
  editorStore.setActiveTab(id)
}

function handleCloseTab(id: string) {
  editorStore.closeTab(id)
}

function handleMiddleClick(e: MouseEvent, id: string) {
  if (e.button === 1) {
    e.preventDefault()
    handleCloseTab(id)
  }
}

function handleTabDblClick(id: string) {
  const tab = editorStore.tabs.find((t) => t.id === id)
  if (!tab) return
  editingTabId.value = id
  editName.value = tab.name
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function handleEditBlur() {
  finishEditing()
}

function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    finishEditing()
  } else if (e.key === 'Escape') {
    editName.value = editorStore.tabs.find((t) => t.id === editingTabId.value)?.name ?? ''
    editingTabId.value = null
  }
}

function finishEditing() {
  if (editingTabId.value && editName.value.trim()) {
    const tab = editorStore.tabs.find((t) => t.id === editingTabId.value)
    if (tab) {
      tab.name = editName.value.trim()
    }
  }
  editingTabId.value = null
}

function registerInitialSql(id: string, sql: string) {
  if (!(id in initialSqlMap)) {
    initialSqlMap[id] = sql
  }
}

defineExpose({ registerInitialSql, isTabDirty })
</script>

<template>
  <div class="editor-tabs">
    <div class="tabs-scroll">
      <div
        v-for="tab in editorStore.tabs"
        :key="tab.id"
        class="tab-item"
        :class="{ active: tab.id === editorStore.activeTabId }"
        @click="handleSelectTab(tab.id)"
        @dblclick="handleTabDblClick(tab.id)"
        @mousedown="handleMiddleClick($event, tab.id)"
      >
        <span v-if="editingTabId !== tab.id" class="tab-name">
          <span v-if="isTabDirty(tab.id)" class="tab-dirty">*</span>
          {{ tab.name }}
        </span>
        <input
          v-else
          ref="editInputRef"
          v-model="editName"
          class="tab-edit-input"
          @blur="handleEditBlur"
          @keydown="handleEditKeydown"
          @click.stop
        />
        <button
          class="tab-close"
          @click.stop="handleCloseTab(tab.id)"
        >×</button>
      </div>
    </div>
    <button class="tab-new" @click="handleNewTab" title="New Tab">+</button>
  </div>
</template>

<style scoped>
.editor-tabs {
  display: flex;
  align-items: stretch;
  background-color: var(--lb-bg-tertiary);
  border-bottom: 1px solid var(--lb-border-color);
  overflow: hidden;
  min-height: 32px;
}
.tabs-scroll {
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}
.tabs-scroll::-webkit-scrollbar {
  height: 3px;
}
.tabs-scroll::-webkit-scrollbar-thumb {
  background: var(--lb-border-color);
  border-radius: 3px;
}
.tab-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  min-width: 0;
  height: 32px;
  font-size: 12px;
  color: var(--lb-text-secondary);
  cursor: pointer;
  border-right: 1px solid var(--lb-border-color);
  background-color: var(--lb-bg-secondary);
  white-space: nowrap;
  user-select: none;
  transition: background-color 0.15s;
}
.tab-item:hover {
  background-color: var(--lb-hover-bg);
}
.tab-item.active {
  background-color: var(--lb-bg-primary);
  color: var(--lb-text-primary);
  border-bottom: 2px solid var(--lb-accent-color);
}
.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.tab-dirty {
  color: var(--lb-accent-color);
  margin-right: 1px;
}
.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--lb-text-secondary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s, color 0.15s;
}
.tab-close:hover {
  background-color: var(--lb-hover-bg);
  color: var(--lb-text-primary);
}
.tab-edit-input {
  width: 100px;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--lb-accent-color);
  border-radius: 3px;
  background: var(--lb-bg-primary);
  color: var(--lb-text-primary);
  font-size: 12px;
  outline: none;
  line-height: 20px;
}
.tab-new {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-left: 1px solid var(--lb-border-color);
  background: var(--lb-bg-secondary);
  color: var(--lb-text-secondary);
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s, color 0.15s;
}
.tab-new:hover {
  background-color: var(--lb-hover-bg);
  color: var(--lb-text-primary);
}
</style>
