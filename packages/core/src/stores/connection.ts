import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  loadConnections as loadConnectionsApi, 
  saveConnections as saveConnectionsApi, 
  loadFolders as loadFoldersApi, 
  saveFolders as saveFoldersApi,
  type StoredConnection,
  type StoredFolder
} from '@linkbase/core/api'

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

function cleanupLocalStorage() {
  localStorage.removeItem('linkbase_connections')
  localStorage.removeItem('linkbase_folders')
}

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<Connection[]>([])
  const currentConnectionId = ref<string | null>(null)
  const folders = ref<ConnectionFolder[]>([])
  const autoReconnect = ref(true)
  const connectionOrder = ref<string[]>(loadOrder().connectionOrder)
  const folderOrder = ref<string[]>(loadOrder().folderOrder)

  async function loadFromBackend() {
    cleanupLocalStorage()
    
    try {
      const [storedConns, storedFolders] = await Promise.all([
        loadConnectionsApi().catch(() => []),
        loadFoldersApi().catch(() => [])
      ])

      connections.value = storedConns.map((c) => ({
        ...c,
        folderId: c.folder_id,
        status: 'idle',
      }))
      folders.value = storedFolders
    } catch {}
  }

  async function saveToBackend(conns: Connection[], folderList: ConnectionFolder[]) {
    // 加载当前已保存的连接，保留密码
    const existingConns = await loadConnectionsApi().catch(() => [] as StoredConnection[])
    const existingConnMap = new Map(existingConns.map(c => [c.id, c]))
    
    // 注意：Connection 对象中没有 password 字段，密码只在新建/编辑连接时临时传递
    const storedConns: StoredConnection[] = conns.map((c) => {
      const existing = existingConnMap.get(c.id)
      return {
        id: c.id,
        name: c.name,
        host: c.host,
        port: c.port,
        user: c.user,
        database: c.database,
        username: c.username,
        driver_type: c.driver_type,
        connection_string: c.connection_string,
        options: c.options,
        folder_id: c.folderId,
        password: existing?.password, // 保留后端已保存的密码
      }
    })

    const storedFolders: StoredFolder[] = folderList.map((f) => ({
      id: f.id,
      name: f.name,
    }))

    await Promise.all([
      saveConnectionsApi(storedConns).catch(() => {}),
      saveFoldersApi(storedFolders).catch(() => {}),
    ])
  }

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
    saveToBackend(connections.value, folders.value)
  }

  function removeConnection(id: string) {
    connections.value = connections.value.filter((c) => c.id !== id)
    connectionOrder.value = connectionOrder.value.filter((cid) => cid !== id)
    if (currentConnectionId.value === id) {
      currentConnectionId.value = null
    }
    persistOrder()
    saveToBackend(connections.value, folders.value)
  }

  function setCurrentConnection(id: string | null) {
    currentConnectionId.value = id
  }

  function updateConnectionStatus(id: string, status: ConnectionStatus) {
    const conn = connections.value.find((c) => c.id === id)
    if (conn) conn.status = status
  }

  function updateConnectionBackendId(id: string, backendId: string) {
    const conn = connections.value.find((c) => c.id === id)
    if (conn) conn.id = backendId
  }

  function updateConnection(id: string, updates: Partial<Connection>) {
    const conn = connections.value.find((c) => c.id === id)
    if (!conn) return
    
    const configUpdates: Partial<Connection> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'status') {
        configUpdates[key as keyof Connection] = value
      }
    }
    
    if (Object.keys(configUpdates).length === 0) return
    
    Object.assign(conn, configUpdates)
    saveToBackend(connections.value, folders.value)
  }

  function addFolder(name: string): ConnectionFolder {
    const folder = { id: crypto.randomUUID?.() ?? `folder-${Date.now()}`, name }
    folders.value.push(folder)
    folderOrder.value.push(folder.id)
    persistOrder()
    saveToBackend(connections.value, folders.value)
    return folder
  }

  function removeFolder(id: string) {
    folders.value = folders.value.filter((f) => f.id !== id)
    folderOrder.value = folderOrder.value.filter((fid) => fid !== id)
    connections.value.filter((c) => c.folderId === id).forEach((c) => (c.folderId = undefined))
    persistOrder()
    saveToBackend(connections.value, folders.value)
  }

  function renameFolder(id: string, name: string) {
    const folder = folders.value.find((f) => f.id === id)
    if (folder) folder.name = name
    saveToBackend(connections.value, folders.value)
  }

  function moveToFolder(connectionId: string, folderId: string | undefined) {
    const conn = connections.value.find((c) => c.id === connectionId)
    if (conn) conn.folderId = folderId
    saveToBackend(connections.value, folders.value)
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

  function cloneConnection(sourceId: string): Connection | null {
    const source = connections.value.find((c) => c.id === sourceId)
    if (!source) return null

    const newId = crypto.randomUUID?.() ?? `conn-${Date.now()}`
    const cloned: Connection = {
      ...source,
      id: newId,
      name: `${source.name} - 副本`,
      status: 'idle',
      folderId: source.folderId,
    }

    connections.value.push(cloned)
    connectionOrder.value.push(newId)
    persistOrder()
    saveToBackend(connections.value, folders.value)
    return cloned
  }

  return {
    connections,
    currentConnectionId,
    folders,
    autoReconnect,
    connectionOrder,
    folderOrder,
    connectionsByFolder,
    loadFromBackend,
    addConnection,
    removeConnection,
    setCurrentConnection,
    updateConnectionStatus,
    updateConnection,
    updateConnectionBackendId,
    addFolder,
    removeFolder,
    renameFolder,
    moveToFolder,
    moveConnection,
    moveFolder,
    cloneConnection,
  }
})
