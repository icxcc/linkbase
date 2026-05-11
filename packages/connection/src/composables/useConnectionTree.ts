import { ref, shallowRef } from 'vue'
import { h } from 'vue'
import type { TreeOption } from 'naive-ui'
import { NIcon, NTag } from 'naive-ui'
import { FolderOutline, FolderOpenOutline, LayersOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import type { Connection } from '@linkbase/core/stores/connection'
import {
  getEnhancedMetadata,
  getDatabases,
  getSchemas,
  connect as connectApi,
  disconnect as disconnectApi,
  testConnection as testConnectionApi,
} from '@linkbase/core/api'
import type { DatabaseMetadata, DatabaseInfo, SchemaInfo } from '@linkbase/core/api'
import { TREE_NODE_TEMPLATES } from '../config/database-types'
import type { DriverType } from '../config/database-types'
import type { TreeOptionWithMeta } from '../types/tree'
import { buildConnectionNode, setNodeData, getNodeData, buildCategoryChildren } from '../utils/treeUtils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContextMenuState {
  show: boolean
  x: number
  y: number
  items: { key: string; label: string; icon?: string }[]
  contextNodeKey?: string
  contextNodeData?: any
}

// ─── Main Composable ─────────────────────────────────────────────────────────

export function useConnectionTree(emit: ReturnType<typeof defineEmits<{
  openCreateDialog: []
  openEditDialog: [connectionId: string]
  executeSql: [sql: string]
}>>) {
  const { t } = useI18n()
  const connectionStore = useConnectionStore()

  // ─── Reactive State ──────────────────────────────────────────────────────

  const treeData = ref<TreeOptionWithMeta[]>([])
  const expandedKeys = ref<string[]>([])
  const selectedKeys = ref<string[]>([])
  const searchText = ref('')
  const connectionMetadata = shallowRef<Map<string, DatabaseMetadata>>(new Map())
  const connectingConnections = ref<Set<string>>(new Set())

  const contextMenu = ref<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    items: [],
    contextNodeKey: undefined,
    contextNodeData: undefined,
  })

  // ─── Tree Data Building ──────────────────────────────────────────────────

  function refreshTreeData() {
    const data: TreeOptionWithMeta[] = []
    for (const group of connectionStore.connectionsByFolder) {
      if (group.folder) {
        const folderNode: TreeOptionWithMeta = {
          key: `folder/${group.folder.id}`,
          label: group.folder.name,
          children: group.connections.map((c: Connection) => buildConnectionNode(c)),
          prefix: () => h(NIcon, null, { default: () => h(FolderOutline) }),
          suffix: () => h(NTag, { size: 'tiny', round: true }, { default: () => String(group.connections.length) }),
        }
        setNodeData(folderNode, { nodeType: 'folder' })
        data.push(folderNode)
      } else {
        for (const c of group.connections) {
          data.push(buildConnectionNode(c))
        }
      }
    }
    treeData.value = data
  }

  // ─── Tree Node Updates ───────────────────────────────────────────────────

  function updateTreeNode(key: string, updates: Partial<TreeOption>) {
    function walk(nodes: TreeOption[]): boolean {
      for (const node of nodes) {
        if (node.key === key) {
          Object.assign(node, updates)
          return true
        }
        if (node.children && walk(node.children)) return true
      }
      return false
    }
    walk(treeData.value as TreeOption[])
  }

  // ─── Connection Lifecycle ────────────────────────────────────────────────

  function initTreeData() {
    refreshTreeData()
    connectionStore.$subscribe(() => {
      refreshTreeData()
    })
  }

  async function handleConnect(connId: string): Promise<boolean> {
    const c = connectionStore.connections.find((x) => x.id === connId)
    if (!c) return false

    if (c.status === 'connected') {
      if (!expandedKeys.value.includes(`conn/${connId}`)) {
        expandedKeys.value = [...expandedKeys.value, `conn/${connId}`]
      }
      return true
    }

    if (c.status === 'connecting' || connectingConnections.value.has(connId)) {
      return false
    }

    connectingConnections.value.add(connId)
    connectionStore.updateConnectionStatus(connId, 'connecting')
    try {
      await connectApi(connId)
      connectionStore.updateConnectionStatus(connId, 'connected')
      connectionStore.setCurrentConnection(connId)
      return true
    } catch (err) {
      connectionStore.updateConnectionStatus(connId, 'error')
      console.error('Connection failed:', err)
      return false
    } finally {
      connectingConnections.value.delete(connId)
    }
  }

  async function handleDisconnect(connId: string) {
    try {
      await disconnectApi(connId)
      connectionStore.updateConnectionStatus(connId, 'disconnected')
      connectionMetadata.value.delete(connId)
      if (connectionStore.currentConnectionId === connId) {
        connectionStore.setCurrentConnection(null)
      }
      // Collapse and reset to trigger re-load next time
      expandedKeys.value = expandedKeys.value.filter((k) => !k.startsWith(`conn/${connId}`))
      updateTreeNode(`conn/${connId}`, { children: undefined })
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  // ─── Metadata Loading (lazy) ──────────────────────────────────────────────

  /**
   * NTree on-load callback: called when a node with children=undefined is expanded.
   * This is the core of the lazy loading mechanism.
   */
  async function handleLazyLoad(node: TreeOption): Promise<void> {
    const nodeData = getNodeData(node)
    if (!nodeData) return

    if (nodeData.nodeType === 'connection') {
      // Connection node expanded: connect if needed, then load database list
      const connId = nodeData.connectionId!
      let c = connectionStore.connections.find((x) => x.id === connId)
      if (!c) return

      if (c.status !== 'connected') {
        await handleConnect(connId)
        c = connectionStore.connections.find((x) => x.id === connId)
        if (!c || c.status !== 'connected') return
      }

      // Only fetch database names (fast), not full metadata
      const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
      if (!template) return

      try {
        const dbNames = await getDatabases(connId)
        const children: TreeOptionWithMeta[] = []

        // Top-level categories
        if (template.topLevelCategories) {
          for (const category of template.topLevelCategories) {
            const catNode: TreeOptionWithMeta = {
              key: `conn/${connId}/cat/${category.key}`,
              label: category.label,
              children: undefined,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            }
            setNodeData(catNode, { nodeType: 'category', connectionId: connId, categoryKey: category.key })
            children.push(catNode)
          }
        }

        if (template.rootContainerType === 'databases' || template.rootContainerType === 'databases_with_schemas') {
          // Build database nodes with children=undefined for lazy loading
          for (const dbName of dbNames) {
            const dbKey = `conn/${connId}/container/db/${dbName}`
            const dbNode: TreeOptionWithMeta = {
              key: dbKey,
              label: dbName,
              children: undefined,
              prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
              isLeaf: false,
            }
            setNodeData(dbNode, { nodeType: 'database', connectionId: connId, databaseName: dbName })
            children.push(dbNode)
          }
        } else {
          // flat / schemas: create category nodes
          for (const category of template.categories) {
            const catNode: TreeOptionWithMeta = {
              key: `conn/${connId}/cat/${category.key}`,
              label: category.label,
              children: undefined,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            }
            setNodeData(catNode, { nodeType: 'category', connectionId: connId, categoryKey: category.key })
            children.push(catNode)
          }
        }

        node.children = children
      } catch (err) {
        console.error('Failed to load databases:', err)
        node.children = []
      }

    } else if (nodeData.nodeType === 'database') {
      // Database node expanded: load schemas (PG) or category folders (MySQL)
      const connId = nodeData.connectionId!
      const dbName = nodeData.databaseName!
      const c = connectionStore.connections.find((x) => x.id === connId)
      if (!c) return

      const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
      if (!template) return

      try {
        if (template.rootContainerType === 'databases_with_schemas') {
          // PostgreSQL: load schema names
          const schemaNames = await getSchemas(connId, dbName)
          const children: TreeOptionWithMeta[] = []
          for (const schName of schemaNames) {
            const schKey = `conn/${connId}/container/db/${dbName}/schema/${schName}`
            const schNode: TreeOptionWithMeta = {
              key: schKey,
              label: schName,
              children: undefined,
              prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
              isLeaf: false,
            }
            setNodeData(schNode, { nodeType: 'schema', connectionId: connId, databaseName: dbName, schemaName: schName })
            children.push(schNode)
          }
          node.children = children
        } else {
          // MySQL: show category folders under database
          const children = template.categories.map((category: any) => {
            const catNode: TreeOptionWithMeta = {
              key: `conn/${connId}/container/db/${dbName}/cat/${category.key}`,
              label: category.label,
              children: undefined,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            }
            setNodeData(catNode, { nodeType: 'category', connectionId: connId, databaseName: dbName, categoryKey: category.key })
            return catNode
          })
          node.children = children
        }
      } catch (err) {
        console.error('Failed to load schemas:', err)
        node.children = []
      }

    } else if (nodeData.nodeType === 'schema') {
      // Schema node expanded: show category folders
      const connId = nodeData.connectionId!
      const dbName = nodeData.databaseName!
      const schName = nodeData.schemaName!
      const c = connectionStore.connections.find((x) => x.id === connId)
      if (!c) return

      const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
      if (!template) return

      const children = template.categories.map((category: any) => {
        const catNode: TreeOptionWithMeta = {
          key: `conn/${connId}/container/db/${dbName}/schema/${schName}/cat/${category.key}`,
          label: category.label,
          children: undefined,
          prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
          isLeaf: false,
        }
        setNodeData(catNode, { nodeType: 'category', connectionId: connId, databaseName: dbName, schemaName: schName, categoryKey: category.key })
        return catNode
      })
      node.children = children

    } else if (nodeData.nodeType === 'category') {
      // Category node expanded: load actual objects (tables, views, etc.)
      const connId = nodeData.connectionId!
      const c = connectionStore.connections.find((x) => x.id === connId)
      if (!c) return

      // Fetch metadata if not cached
      let meta = connectionMetadata.value.get(connId)
      if (!meta) {
        try {
          meta = await getEnhancedMetadata(connId)
          connectionMetadata.value.set(connId, meta)
        } catch (err) {
          console.error('Failed to load metadata:', err)
          node.children = []
          return
        }
      }

      const categoryKey = nodeData.categoryKey!
      const dbName = nodeData.databaseName
      const schName = nodeData.schemaName

      let db: DatabaseInfo = {} as DatabaseInfo
      let schema: SchemaInfo = {} as SchemaInfo

      if (dbName) {
        db = meta.databases?.find((d) => d.name === dbName) || ({} as DatabaseInfo)
        if (schName) {
          schema = db.schemas?.find((s) => s.name === schName) || ({} as SchemaInfo)
        }
      }

      const keyPrefix = String(node.key)
      const tables = meta.tables || []
      const children = buildCategoryChildren(
        { key: categoryKey, label: '' },
        dbName,
        schName,
        connId,
        db,
        schema,
        tables,
        keyPrefix,
        meta
      )
      node.children = children
    }
  }

  async function refreshConnection(connId: string): Promise<void> {
    connectionMetadata.value.delete(connId)
    // Reset connection node to trigger re-load
    updateTreeNode(`conn/${connId}`, { children: undefined })
  }

  // ─── Event Handlers ──────────────────────────────────────────────────────

  function onExpandedKeysChange(keys: string[]) {
    expandedKeys.value = keys
  }

  function onSelectedKeysChange(keys: string[]) {
    selectedKeys.value = keys
  }

  // ─── Context Menu ────────────────────────────────────────────────────────

  function onPanelContextMenu(e: MouseEvent) {
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      items: [
        { key: 'newConnection', label: t('connection.newConnection') },
        { key: 'newFolder', label: t('contextMenu.newFolder') },
      ],
      contextNodeKey: undefined,
      contextNodeData: undefined,
    }
  }

  function onNodeContextMenu(e: MouseEvent, node: TreeOption) {
    const nodeData = getNodeData(node)
    e.preventDefault()

    const items: { key: string; label: string; icon?: string }[] = []

    if (!nodeData) {
      items.push(
        { key: 'newConnection', label: t('connection.newConnection') },
        { key: 'newFolder', label: t('contextMenu.newFolder') },
      )
    } else if (nodeData.nodeType === 'folder') {
      items.push(
        { key: 'renameFolder', label: t('contextMenu.rename') },
        { key: 'deleteFolder', label: t('contextMenu.delete') },
      )
    } else if (nodeData.nodeType === 'connection') {
      const conn = connectionStore.connections.find((c) => c.id === nodeData.connectionId)
      if (conn?.status === 'connected') {
        items.push(
          { key: 'connDisconnect', label: t('contextMenu.disconnect') },
          { key: 'connRefresh', label: t('contextMenu.refresh') },
          { key: 'connClone', label: t('contextMenu.clone') },
          { key: 'connEdit', label: t('contextMenu.edit') },
        )
      } else {
        items.push(
          { key: 'connConnect', label: t('contextMenu.connect') },
          { key: 'connEdit', label: t('contextMenu.edit') },
          { key: 'connClone', label: t('contextMenu.clone') },
          { key: 'connTest', label: t('contextMenu.testConnection') },
        )
      }
      items.push({ key: 'connDelete', label: t('contextMenu.deleteConnection') })
    } else if (nodeData.nodeType === 'database') {
      items.push(
        { key: 'generateUseDb', label: t('contextMenu.useDatabase') },
        { key: 'copyName', label: t('contextMenu.copyName') },
      )
    } else if (nodeData.nodeType === 'schema') {
      items.push(
        { key: 'setSearchPath', label: t('contextMenu.setSearchPath') },
        { key: 'copyName', label: t('contextMenu.copyName') },
      )
    } else if (nodeData.nodeType === 'table') {
      items.push(
        { key: 'generateSelect', label: t('contextMenu.generateSelect') },
        { key: 'generateSelectCount', label: t('contextMenu.generateSelectCount') },
        { key: 'generateInsert', label: t('contextMenu.generateInsert') },
        { key: 'generateDrop', label: t('contextMenu.generateDrop') },
        { key: 'copyTableName', label: t('contextMenu.copyName') },
      )
    } else if (nodeData.nodeType === 'view' || nodeData.nodeType === 'materializedView') {
      items.push(
        { key: 'generateSelect', label: t('contextMenu.generateSelect') },
        { key: 'generateDrop', label: t('contextMenu.generateDrop') },
        { key: 'copyTableName', label: t('contextMenu.copyName') },
      )
    } else if (nodeData.nodeType === 'function' || nodeData.nodeType === 'procedure') {
      items.push(
        { key: 'generateCall', label: t('contextMenu.generateCall') },
        { key: 'generateDrop', label: t('contextMenu.generateDrop') },
        { key: 'copyName', label: t('contextMenu.copyName') },
      )
    } else if (nodeData.nodeType === 'column') {
      items.push(
        { key: 'copyColumnName', label: t('contextMenu.copyName') },
        { key: 'generateSelectColumn', label: t('contextMenu.generateSelectColumn') },
      )
    } else if (nodeData.nodeType === 'trigger') {
      items.push(
        { key: 'generateDrop', label: t('contextMenu.generateDrop') },
        { key: 'copyName', label: t('contextMenu.copyName') },
      )
    } else if (nodeData.nodeType === 'category' || nodeData.nodeType === 'rootContainer') {
      items.push(
        { key: 'connRefresh', label: t('contextMenu.refresh') },
      )
    } else {
      items.push(
        { key: 'copyName', label: t('contextMenu.copyName') },
      )
    }

    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      items,
      contextNodeKey: String(node.key),
      contextNodeData: nodeData,
    }
  }

  async function onContextMenuSelect(key: string) {
    const nodeData = contextMenu.value.contextNodeData
    const nodeKey = contextMenu.value.contextNodeKey

    switch (key) {
      case 'newConnection':
        emit('openCreateDialog')
        break
      case 'newFolder':
        addFolder()
        break
      case 'renameFolder':
        renameFolder(nodeKey)
        break
      case 'deleteFolder':
        deleteFolder(nodeKey)
        break
      case 'connConnect':
        if (nodeData?.connectionId) await handleConnect(nodeData.connectionId)
        break
      case 'connDisconnect':
        if (nodeData?.connectionId) handleDisconnect(nodeData.connectionId)
        break
      case 'connEdit':
        if (nodeData?.connectionId) emit('openEditDialog', nodeData.connectionId)
        break
      case 'connDelete':
        if (nodeData?.connectionId) deleteConnection(nodeData.connectionId)
        break
      case 'connRefresh':
        if (nodeData?.connectionId) refreshConnection(nodeData.connectionId)
        break
      case 'connClone':
        if (nodeData?.connectionId) handleCloneConnection(nodeData.connectionId)
        break
      case 'connTest':
        if (nodeData?.connectionId) handleTestConnection(nodeData.connectionId)
        break
      case 'generateSelect': {
        const tableName = nodeData?.tableName || ''
        const qualifiedName = nodeData?.schemaName ? `${nodeData.schemaName}.${tableName}` : tableName
        if (qualifiedName) emit('executeSql', `SELECT * FROM ${qualifiedName} LIMIT 100`)
        break
      }
      case 'copyTableName':
      case 'copyName':
        if (nodeData?.tableName) navigator.clipboard.writeText(nodeData.tableName)
        break
    }

    contextMenu.value.show = false
  }

  // ─── Double Click Handler ────────────────────────────────────────────────

  function handleNodeDblClick(node: TreeOption) {
    const nodeData = getNodeData(node)
    if (!nodeData) return

    if (nodeData.nodeType === 'connection') {
      if (nodeData.connectionId) {
        const key = `conn/${nodeData.connectionId}`
        if (!expandedKeys.value.includes(key)) {
          expandedKeys.value = [...expandedKeys.value, key]
          // NTree's on-load will handle connecting + loading
        } else {
          expandedKeys.value = expandedKeys.value.filter((k) => k !== key)
        }
      }
    } else if (nodeData.nodeType === 'table' || nodeData.nodeType === 'view' || nodeData.nodeType === 'materializedView') {
      const tableName = nodeData.tableName || ''
      const qualifiedName = nodeData.schemaName ? `${nodeData.schemaName}.${tableName}` : tableName
      if (qualifiedName) emit('executeSql', `SELECT * FROM ${qualifiedName} LIMIT 100`)
    }
  }

  // ─── Drag & Drop ────────────────────────────────────────────────────────

  function allowDrop({ node, dropPosition }: { node: TreeOption; dropPosition: 'before' | 'inside' | 'after'; phase: 'drag' | 'drop' }) {
    const targetData = getNodeData(node)
    if (targetData?.nodeType === 'folder' && dropPosition === 'inside') return true
    if ((targetData?.nodeType === 'connection' || targetData?.nodeType === 'folder') && dropPosition !== 'inside') return true
    return false
  }

  function onDrop({ node: dropNode, dragNode, dropPosition }: { node: TreeOption; dragNode: TreeOption; dropPosition: 'before' | 'inside' | 'after'; event: DragEvent }) {
    const dragKey = String(dragNode.key ?? '')
    if (!dragKey.startsWith('conn/')) return

    const connId = dragKey.replace('conn/', '')
    if (!connId) return

    const dropData = getNodeData(dropNode)
    if (dropData?.nodeType === 'folder' && dropPosition === 'inside') {
      const folderId = String(dropNode.key).replace('folder/', '')
      connectionStore.moveToFolder(connId, folderId)
      refreshTreeData()
    }
  }

  // ─── CRUD Operations ─────────────────────────────────────────────────────

  function addFolder() {
    const name = prompt(t('contextMenu.folderNamePrompt'))
    if (!name?.trim()) return
    connectionStore.addFolder(name.trim())
  }

  function renameFolder(nodeKey?: string) {
    if (!nodeKey) return
    const folderId = nodeKey.replace('folder/', '')
    const name = prompt(t('contextMenu.renamePrompt'))
    if (name?.trim()) connectionStore.renameFolder(folderId, name.trim())
  }

  function deleteFolder(nodeKey?: string) {
    if (!nodeKey) return
    const folderId = nodeKey.replace('folder/', '')
    connectionStore.removeFolder(folderId)
  }

  function deleteConnection(connId: string) {
    if (confirm(t('contextMenu.confirmDelete'))) {
      connectionStore.removeConnection(connId)
    }
  }

  function handleCloneConnection(connId: string) {
    connectionStore.cloneConnection(connId)
  }

  async function handleTestConnection(connId: string) {
    const c = connectionStore.connections.find((x) => x.id === connId)
    if (!c) return

    try {
      const result = await testConnectionApi({
        driver_type: c.driver_type,
        host: c.host,
        port: c.port,
        database: c.database,
        username: c.username,
        password: '',
      })
      if (result.success) {
        alert(t('connection.testSuccess', { version: result.server_version, latency: result.latency_ms.toFixed(0) }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(t('connection.testFail', { message: msg }))
    }
  }

  // ─── Node Props ──────────────────────────────────────────────────────────

  const nodeProps = (info: { option: TreeOption }) => ({
    onContextmenu: (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onNodeContextMenu(e, info.option)
    },
  })

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    treeData,
    expandedKeys,
    selectedKeys,
    searchText,
    contextMenu,
    nodeProps,
    initTreeData,
    refreshConnection,
    handleLazyLoad,
    onExpandedKeysChange,
    onSelectedKeysChange,
    onPanelContextMenu,
    onContextMenuSelect,
    handleNodeDblClick,
    allowDrop,
    onDrop,
    addFolder,
  }
}
