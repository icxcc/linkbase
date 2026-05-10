import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export interface ResultSet {
  id: string
  columns: string[]
  rows: unknown[][]
  executionTime?: number
  totalRows?: number
}

export interface LogEntry {
  id: string
  message: string
  level: 'info' | 'warn' | 'error' | 'success'
  timestamp: number
}

export const useResultStore = defineStore('result', () => {
  const results = shallowRef<ResultSet[]>([])
  const logs = ref<LogEntry[]>([])
  const error = ref<string | null>(null)
  const loading = ref(false)
  const lastExecutionTime = ref<number | undefined>(undefined)
  const lastAffectedRows = ref<number | undefined>(undefined)
  const isStreaming = ref(false)
  const currentChunk = ref(0)
  const totalChunks = ref(0)

  function setResults(value: ResultSet[]) {
    results.value = value
    error.value = null
    isStreaming.value = false
    currentChunk.value = 0
    totalChunks.value = 0
  }

  function appendRows(resultId: string, newRows: unknown[][], totalRows?: number) {
    const result = results.value.find(r => r.id === resultId)
    if (result) {
      result.rows.push(...newRows)
      if (totalRows !== undefined) {
        result.totalRows = totalRows
      }
    }
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

  function setStreaming(isStreamingValue: boolean, chunk: number = 0, total: number = 0) {
    isStreaming.value = isStreamingValue
    currentChunk.value = chunk
    totalChunks.value = total
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
    isStreaming.value = false
    currentChunk.value = 0
    totalChunks.value = 0
  }

  return {
    results,
    logs,
    error,
    loading,
    lastExecutionTime,
    lastAffectedRows,
    isStreaming,
    currentChunk,
    totalChunks,
    setResults,
    appendRows,
    setError,
    setLoading,
    setExecutionMeta,
    setStreaming,
    addLog,
    clearResults,
  }
})
