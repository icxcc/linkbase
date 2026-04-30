import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface HistoryEntry {
  id: string
  sql: string
  connectionName: string
  timestamp: number
  favorited: boolean
  note: string
}

const STORAGE_KEY = 'linkbase-query-history'
const MAX_ENTRIES = 500

function loadFromStorage(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch { /* quota exceeded, silently drop */ }
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(loadFromStorage())
  const searchQuery = ref('')

  const filteredEntries = computed(() => {
    const q = searchQuery.value.toLowerCase().trim()
    if (!q) return entries.value

    return entries.value
      .filter((e) => e.sql.toLowerCase().includes(q) || e.connectionName.toLowerCase().includes(q))
  })

  const sortedEntries = computed(() => {
    const favs = filteredEntries.value.filter((e) => e.favorited)
    const rest = filteredEntries.value.filter((e) => !e.favorited)
    return [
      ...favs.sort((a, b) => b.timestamp - a.timestamp),
      ...rest.sort((a, b) => b.timestamp - a.timestamp),
    ]
  })

  function addEntry(sql: string, connectionName: string) {
    const entry: HistoryEntry = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      sql,
      connectionName,
      timestamp: Date.now(),
      favorited: false,
      note: '',
    }
    entries.value.unshift(entry)
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES)
    }
    persist()
  }

  function removeEntry(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    persist()
  }

  function clearHistory() {
    entries.value = []
    persist()
  }

  function toggleFavorite(id: string) {
    const entry = entries.value.find((e) => e.id === id)
    if (entry) {
      entry.favorited = !entry.favorited
      persist()
    }
  }

  function setNote(id: string, note: string) {
    const entry = entries.value.find((e) => e.id === id)
    if (entry) {
      entry.note = note
      persist()
    }
  }

  function setSearchQuery(q: string) {
    searchQuery.value = q
  }

  function persist() {
    saveToStorage(entries.value)
  }

  return {
    entries,
    searchQuery,
    filteredEntries,
    sortedEntries,
    addEntry,
    removeEntry,
    clearHistory,
    toggleFavorite,
    setNote,
    setSearchQuery,
  }
})
