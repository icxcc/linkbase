import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface Connection {
  id: string
  name: string
  host?: string
  port?: number
  user?: string
  database?: string
  username?: string
  driver_type: string
  connection_string?: string
  options?: Record<string, unknown>
  status: ConnectionStatus
  folderId?: string
}

export interface ConnectionFolder {
  id: string
  name: string
}

const ORDER_STORAGE_KEY = 'linkbase_connection_order'

interface StoredOrder {
  connectionOrder: string[]
  folderOrder: string[]
}

function loadOrder(): StoredOrder {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { connectionOrder: [], folderOrder: [] }
}

function saveOrder(order: StoredOrder) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order))
}

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<Connection[]>([])
  const currentConnectionId = ref<string | null>(null)
  const folders = ref<ConnectionFolder[]>([])
  const autoReconnect = ref(true)
  const connectionOrder = ref<string[]>(loadOrder().connectionOrder)
  const folderOrder = ref<string[]>(loadOrder().folderOrder)

  function persistOrder() {
    saveOrder({
      connectionOrder: connectionOrder.value,
      folderOrder: folderOrder.value,
    })
  }

  const connectionsByFolder = computed(() => {
    const result: { folder: ConnectionFolder | null; connections: Connection[] }[] = []

    const folderMap = new Map<string, ConnectionFolder>()
    for (const f of folders.value) {
      folderMap.set(f.id, f)
    }

    const connMap = new Map<string, Connection>()
    for (const c of connections.value) {
      connMap.set(c.id, c)
    }

    const orderedFolders = folderOrder.value
      .map((id) => folderMap.get(id))
      .filter((f): f is ConnectionFolder => !!f)

    for (const f of folders.value) {
      if (!orderedFolders.some((of) => of.id === f.id)) {
        orderedFolders.push(f)
      }
    }

    const ungrouped: Connection[] = []
    const folderConnections = new Map<string, Connection[]>()

    const orderedConns = connectionOrder.value
      .map((id) => connMap.get(id))
      .filter((c): c is Connection => !!c)

    for (const c of connections.value) {
      if (!orderedConns.some((oc) => oc.id === c.id)) {
        orderedConns.push(c)
      }
    }

    for (const c of orderedConns) {
      if (c.folderId && folderMap.has(c.folderId)) {
        if (!folderConnections.has(c.folderId)) {
          folderConnections.set(c.folderId, [])
        }
        folderConnections.get(c.folderId)!.push(c)
      } else {
        ungrouped.push(c)
      }
    }

    if (ungrouped.length > 0) {
      result.push({ folder: null, connections: ungrouped })
    }

    for (const folder of orderedFolders) {
      result.push({
        folder,
        connections: folderConnections.get(folder.id) || [],
      })
    }

    return result
  })

  function addConnection(conn: Omit<Connection, 'status'>) {
    connections.value.push({ ...conn, status: 'idle' })
    connectionOrder.value.push(conn.id)
    persistOrder()
  }

  function removeConnection(id: string) {
    connections.value = connections.value.filter((c) => c.id !== id)
    connectionOrder.value = connectionOrder.value.filter((cid) => cid !== id)
    if (currentConnectionId.value === id) {
      currentConnectionId.value = null
    }
    persistOrder()
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
    folderOrder.value.push(folder.id)
    persistOrder()
    return folder
  }

  function removeFolder(id: string) {
    folders.value = folders.value.filter((f) => f.id !== id)
    folderOrder.value = folderOrder.value.filter((fid) => fid !== id)
    connections.value.filter((c) => c.folderId === id).forEach((c) => (c.folderId = undefined))
    persistOrder()
  }

  function renameFolder(id: string, name: string) {
    const folder = folders.value.find((f) => f.id === id)
    if (folder) folder.name = name
  }

  function moveToFolder(connectionId: string, folderId: string | undefined) {
    const conn = connections.value.find((c) => c.id === connectionId)
    if (conn) conn.folderId = folderId
  }

  function moveConnection(targetId: string, targetFolderId: string | undefined, index: number) {
    moveToFolder(targetId, targetFolderId)

    const idx = connectionOrder.value.indexOf(targetId)
    if (idx !== -1) {
      connectionOrder.value.splice(idx, 1)
    }
    connectionOrder.value.splice(index, 0, targetId)
    persistOrder()
  }

  function moveFolder(targetId: string, index: number) {
    const idx = folderOrder.value.indexOf(targetId)
    if (idx !== -1) {
      folderOrder.value.splice(idx, 1)
    }
    folderOrder.value.splice(index, 0, targetId)
    persistOrder()
  }

  return {
    connections,
    currentConnectionId,
    folders,
    autoReconnect,
    connectionOrder,
    folderOrder,
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
    moveConnection,
    moveFolder,
  }
})
