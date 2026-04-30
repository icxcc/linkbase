import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ResultSet {
  id: string
  columns: string[]
  rows: unknown[][]
  executionTime?: number
}

export interface LogEntry {
  id: string
  message: string
  level: 'info' | 'warn' | 'error' | 'success'
  timestamp: number
}

export const useResultStore = defineStore('result', () => {
  const results = ref<ResultSet[]>([])
  const logs = ref<LogEntry[]>([])
  const error = ref<string | null>(null)
  const loading = ref(false)
  const lastExecutionTime = ref<number | undefined>(undefined)
  const lastAffectedRows = ref<number | undefined>(undefined)

  function setResults(value: ResultSet[]) {
    results.value = value
    error.value = null
  }

  function setError(message: string | null) {
    error.value = message
    if (message) {
      results.value = []
    }
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  function setExecutionMeta(time?: number, affected?: number) {
    lastExecutionTime.value = time
    lastAffectedRows.value = affected
  }

  function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    logs.value.push({
      ...entry,
      id: crypto.randomUUID?.() ?? String(Date.now()),
      timestamp: Date.now(),
    })
  }

  function clearResults() {
    results.value = []
    error.value = null
    lastExecutionTime.value = undefined
    lastAffectedRows.value = undefined
  }

  return {
    results,
    logs,
    error,
    loading,
    lastExecutionTime,
    lastAffectedRows,
    setResults,
    setError,
    setLoading,
    setExecutionMeta,
    addLog,
    clearResults,
  }
})
