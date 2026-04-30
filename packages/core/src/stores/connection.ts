import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface Connection {
  id: string
  name: string
  host: string
  port: number
  database?: string
  username?: string
  driver_type: string
  connection_string: string
  options?: Record<string, unknown>
  status: ConnectionStatus
  folderId?: string
}

export interface ConnectionFolder {
  id: string
  name: string
}

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<Connection[]>([])
  const currentConnectionId = ref<string | null>(null)
  const folders = ref<ConnectionFolder[]>([])
  const autoReconnect = ref(true)

  const connectionsByFolder = computed(() => {
    const result: { folder: ConnectionFolder | null; connections: Connection[] }[] = []
    const ungrouped = connections.value.filter((c) => !c.folderId)
    if (ungrouped.length > 0) {
      result.push({ folder: null, connections: ungrouped })
    }
    for (const folder of folders.value) {
      const conns = connections.value.filter((c) => c.folderId === folder.id)
      result.push({ folder, connections: conns })
    }
    return result
  })

  function addConnection(conn: Omit<Connection, 'status'>) {
    connections.value.push({ ...conn, status: 'idle' })
  }

  function removeConnection(id: string) {
    connections.value = connections.value.filter((c) => c.id !== id)
    if (currentConnectionId.value === id) {
      currentConnectionId.value = null
    }
  }

  function setCurrentConnection(id: string | null) {
    currentConnectionId.value = id
  }

  function updateConnectionStatus(id: string, status: ConnectionStatus) {
    const conn = connections.value.find((c) => c.id === id)
    if (conn) conn.status = status
  }

  function updateConnection(id: string, updates: Partial<Connection>) {
    const conn = connections.value.find((c) => c.id === id)
    if (conn) Object.assign(conn, updates)
  }

  function addFolder(name: string): ConnectionFolder {
    const folder = { id: crypto.randomUUID?.() ?? `folder-${Date.now()}`, name }
    folders.value.push(folder)
    return folder
  }

  function removeFolder(id: string) {
    folders.value = folders.value.filter((f) => f.id !== id)
    connections.value.filter((c) => c.folderId === id).forEach((c) => (c.folderId = undefined))
  }

  function renameFolder(id: string, name: string) {
    const folder = folders.value.find((f) => f.id === id)
    if (folder) folder.name = name
  }

  function moveToFolder(connectionId: string, folderId: string | undefined) {
    const conn = connections.value.find((c) => c.id === connectionId)
    if (conn) conn.folderId = folderId
  }

  return {
    connections,
    currentConnectionId,
    folders,
    autoReconnect,
    connectionsByFolder,
    addConnection,
    removeConnection,
    setCurrentConnection,
    updateConnectionStatus,
    updateConnection,
    addFolder,
    removeFolder,
    renameFolder,
    moveToFolder,
  }
})
