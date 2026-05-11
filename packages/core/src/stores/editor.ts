import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TabSession {
  connectionId: string | null
  database: string | null
  schema: string | null
}

export interface Tab {
  id: string
  name: string
  sql: string
  session: TabSession
}

export const useEditorStore = defineStore('editor', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  function addTab(tab: Omit<Tab, 'session'> & { session?: Partial<TabSession> }) {
    const fullTab: Tab = {
      ...tab,
      session: {
        connectionId: tab.session?.connectionId ?? null,
        database: tab.session?.database ?? null,
        schema: tab.session?.schema ?? null,
      },
    }
    tabs.value.push(fullTab)
    if (!activeTabId.value) {
      activeTabId.value = fullTab.id
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

  function updateTabSession(id: string, session: Partial<TabSession>) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      if (session.connectionId !== undefined) {
        tab.session.connectionId = session.connectionId
        // Reset database and schema when connection changes
        if (session.database === undefined) tab.session.database = null
        if (session.schema === undefined) tab.session.schema = null
      }
      if (session.database !== undefined) {
        tab.session.database = session.database
        // Reset schema when database changes
        if (session.schema === undefined) tab.session.schema = null
      }
      if (session.schema !== undefined) {
        tab.session.schema = session.schema
      }
    }
  }

  function getTabSession(id: string): TabSession | null {
    const tab = tabs.value.find((t) => t.id === id)
    return tab?.session ?? null
  }

  return {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTabSql,
    updateTabSession,
    getTabSession,
  }
})
