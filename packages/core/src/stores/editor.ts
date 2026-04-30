import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Tab {
  id: string
  name: string
  sql: string
}

export const useEditorStore = defineStore('editor', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  function addTab(tab: Tab) {
    tabs.value.push(tab)
    if (!activeTabId.value) {
      activeTabId.value = tab.id
    }
  }

  function closeTab(id: string) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index === -1) return

    tabs.value.splice(index, 1)

    if (activeTabId.value === id) {
      activeTabId.value = tabs.value.length > 0 ? tabs.value[Math.min(index, tabs.value.length - 1)].id : null
    }
  }

  function setActiveTab(id: string | null) {
    activeTabId.value = id
  }

  function updateTabSql(id: string, sql: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.sql = sql
    }
  }

  return {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTabSql,
  }
})
