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
  const loadingMetadataConnections = ref<Set<string>>(new Set())

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

  /**
   * Build tree children from metadata for a given connection.
   * This shared function eliminates duplication between loadConnectionChildren and refreshConnection.
   */
  function buildMetadataTree(connId: string, meta: DatabaseMetadata, driverType: string): TreeOptionWithMeta[] {
    const template = TREE_NODE_TEMPLATES[driverType as DriverType]
    if (!template) return []

    const children: TreeOptionWithMeta[] = []

    // Top-level categories (e.g., Users, Roles)
    if (template.topLevelCategories) {
      for (const category of template.topLevelCategories) {
        const catNode: TreeOptionWithMeta = {
          key: `conn/${connId}/cat/${category.key}`,
          label: category.label,
          children: [],
          prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
          isLeaf: false,
        }
        setNodeData(catNode, {
          nodeType: 'category',
          connectionId: connId,
          categoryKey: category.key,
        })
        children.push(catNode)
      }
    }

    // Build database/schema structure based on driver type
    switch (template.rootContainerType) {
      case 'databases':
        children.push(buildDatabasesContainer(connId, meta, template))
        break
      case 'databases_with_schemas':
        children.push(buildDatabasesWithSchemasContainer(connId, meta, template))
        break
      case 'schemas':
      case 'flat':
      default:
        for (const category of template.categories) {
          const catNode: TreeOptionWithMeta = {
            key: `conn/${connId}/cat/${category.key}`,
            label: category.label,
            children: [],
            prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
            isLeaf: false,
          }
          setNodeData(catNode, {
            nodeType: 'category',
            connectionId: connId,
            categoryKey: category.key,
          })
          children.push(catNode)
        }
        break
    }

    return children
  }

  function buildDatabasesContainer(connId: string, meta: DatabaseMetadata, template: any): TreeOptionWithMeta {
    const databases = meta.databases || []
    const containerNode: TreeOptionWithMeta = {
      key: `conn/${connId}/container`,
      label: template.rootContainerLabel,
      children: [],
      prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
      isLeaf: false,
    }
    setNodeData(containerNode, { nodeType: 'rootContainer', connectionId: connId })

    for (const db of databases) {
      const dbKey = `conn/${connId}/container/db/${db.name}`
      const dbChildren = template.categories.map((category: any) => {
        const catNode: TreeOptionWithMeta = {
          key: `${dbKey}/cat/${category.key}`,
          label: category.label,
          children: [],
          prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
          isLeaf: false,
        }
        setNodeData(catNode, {
          nodeType: 'category',
          connectionId: connId,
          databaseName: db.name,
          categoryKey: category.key,
        })
        return catNode
      })

      const dbNode: TreeOptionWithMeta = {
        key: dbKey,
        label: db.name,
        children: dbChildren,
        prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
        isLeaf: false,
      }
      setNodeData(dbNode, { nodeType: 'database', connectionId: connId, databaseName: db.name })
      containerNode.children!.push(dbNode)
    }

    return containerNode
  }

  function buildDatabasesWithSchemasContainer(connId: string, meta: DatabaseMetadata, template: any): TreeOptionWithMeta {
    const databases = meta.databases || []
    const containerNode: TreeOptionWithMeta = {
      key: `conn/${connId}/container`,
      label: template.rootContainerLabel,
      children: [],
      prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
      isLeaf: false,
    }
    setNodeData(containerNode, { nodeType: 'rootContainer', connectionId: connId })

    for (const db of databases) {
      const dbKey = `conn/${connId}/container/db/${db.name}`
      const dbChildren: TreeOptionWithMeta[] = []

      for (const schema of (db.schemas || [])) {
        const schKey = `${dbKey}/schema/${schema.name}`
        const schChildren = template.categories.map((category: any) => {
          const catNode: TreeOptionWithMeta = {
            key: `${schKey}/cat/${category.key}`,
            label: category.label,
            children: [],
            prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
            isLeaf: false,
          }
          setNodeData(catNode, {
            nodeType: 'category',
            connectionId: connId,
            databaseName: db.name,
            schemaName: schema.name,
            categoryKey: category.key,
          })
          return catNode
        })

        const schNode: TreeOptionWithMeta = {
          key: schKey,
          label: schema.name,
          children: schChildren,
          prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
          isLeaf: false,
        }
        setNodeData(schNode, { nodeType: 'schema', connectionId: connId, databaseName: db.name, schemaName: schema.name })
        dbChildren.push(schNode)
      }

      const dbNode: TreeOptionWithMeta = {
        key: dbKey,
        label: db.name,
        children: dbChildren,
        prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
        isLeaf: false,
      }
      setNodeData(dbNode, { nodeType: 'database', connectionId: connId, databaseName: db.name })
      containerNode.children!.push(dbNode)
    }

    return containerNode
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

  async function handleConnectionExpand(connId: string) {
    let c = connectionStore.connections.find((x) => x.id === connId)
    if (!c) return

    if (c.status === 'connected') {
      await loadConnectionMetadata(connId)
    } else if (c.status === 'connecting') {
      await waitForConnection(connId)
      c = connectionStore.connections.find((x) => x.id === connId)
      if (c?.status === 'connected') {
        await loadConnectionMetadata(connId)
      }
    } else {
      const success = await handleConnect(connId)
      if (success) {
        await loadConnectionMetadata(connId)
      }
    }
  }

  async function waitForConnection(connId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const c = connectionStore.connections.find((x) => x.id === connId)
        if (c && c.status !== 'connecting') {
          clearInterval(interval)
          resolve()
        }
      }, 100)
      // Safety timeout to avoid infinite polling
      setTimeout(() => { clearInterval(interval); resolve() }, 30000)
    })
  }

  async function handleDisconnect(connId: string) {
    try {
      await disconnectApi(connId)
      connectionStore.updateConnectionStatus(connId, 'disconnected')
      connectionMetadata.value.delete(connId)
      if (connectionStore.currentConnectionId === connId) {
        connectionStore.setCurrentConnection(null)
      }
      // Collapse the disconnected node
      expandedKeys.value = expandedKeys.value.filter((k) => !k.startsWith(`conn/${connId}`))
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  // ─── Metadata Loading (unified) ─────────────────────────────────────────

  async function loadConnectionMetadata(connId: string): Promise<void> {
    const c = connectionStore.connections.find((x) => x.id === connId)
    if (!c || c.status !== 'connected') return

    if (loadingMetadataConnections.value.has(connId)) return

    loadingMetadataConnections.value.add(connId)
    updateTreeNode(`conn/${connId}`, { isLoading: true })

    try {
      const meta = await getEnhancedMetadata(connId)
      connectionMetadata.value.set(connId, meta)

      const children = buildMetadataTree(connId, meta, c.driver_type)
      updateTreeNode(`conn/${connId}`, { children, isLoading: false })

      if (!expandedKeys.value.includes(`conn/${connId}`)) {
        expandedKeys.value = [...expandedKeys.value, `conn/${connId}`]
      }
    } catch (err) {
      console.error('Failed to load metadata:', err)
      updateTreeNode(`conn/${connId}`, { isLoading: false })
    } finally {
      loadingMetadataConnections.value.delete(connId)
    }
  }

  async function refreshConnection(connId: string): Promise<void> {
    connectionMetadata.value.delete(connId)
    await loadConnectionMetadata(connId)
  }

  // ─── Lazy Category Loading ───────────────────────────────────────────────

  function loadCategoryChildren(connId: string, containerName: string | undefined, categoryKey: string) {
    const meta = connectionMetadata.value.get(connId)
    if (!meta) return

    const c = connectionStore.connections.find((x) => x.id === connId)
    if (!c) return

    const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
    if (!template) return

    let category = template.topLevelCategories?.find((cat) => cat.key === categoryKey)
    const isTopLevel = !!category
    if (!category) {
      category = template.categories.find((cat) => cat.key === categoryKey)
    }
    if (!category) return

    let keyPrefix: string
    let db: DatabaseInfo = {} as DatabaseInfo
    let schema: SchemaInfo = {} as SchemaInfo

    if (isTopLevel || template.rootContainerType === 'flat') {
      keyPrefix = `conn/${connId}/cat/${categoryKey}`
    } else if (template.rootContainerType === 'databases') {
      keyPrefix = `conn/${connId}/container/db/${containerName}/cat/${categoryKey}`
      if (containerName) {
        db = meta.databases?.find((d) => d.name === containerName) || ({} as DatabaseInfo)
      }
    } else if (template.rootContainerType === 'databases_with_schemas') {
      if (containerName?.includes('/')) {
        const [dbName, schName] = containerName.split('/')
        keyPrefix = `conn/${connId}/container/db/${dbName}/schema/${schName}/cat/${categoryKey}`
        const foundDb = meta.databases?.find((d) => d.name === dbName)
        if (foundDb) {
          db = foundDb
          schema = foundDb.schemas?.find((s) => s.name === schName) || ({} as SchemaInfo)
        }
      } else {
        keyPrefix = `conn/${connId}/container/db/${containerName}/cat/${categoryKey}`
        if (containerName) {
          db = meta.databases?.find((d) => d.name === containerName) || ({} as DatabaseInfo)
        }
      }
    } else {
      keyPrefix = `conn/${connId}/cat/${categoryKey}`
    }

    const tables = meta.tables || []
    const children = buildCategoryChildren(
      { key: categoryKey, label: '' },
      db.name,
      schema.name,
      connId,
      db,
      schema,
      tables,
      keyPrefix,
      meta
    )
    updateTreeNode(keyPrefix, { children })
  }

  // ─── Event Handlers ──────────────────────────────────────────────────────

  function onExpandedKeysChange(keys: string[]) {
    const newKeys = keys.filter((k) => !expandedKeys.value.includes(k))
    expandedKeys.value = keys

    for (const key of newKeys) {
      if (!key.startsWith('conn/')) continue
      const parts = key.replace('conn/', '').split('/')
      const connId = parts[0]

      if (parts.length === 1) {
        handleConnectionExpand(connId)
      } else {
        const catIndex = parts.indexOf('cat')
        if (catIndex !== -1 && catIndex + 1 < parts.length) {
          const categoryKey = parts[catIndex + 1]
          const containerName = resolveContainerName(parts)
          loadCategoryChildren(connId, containerName, categoryKey)
        }
      }
    }
  }

  /** Extract db/schema container path from key parts */
  function resolveContainerName(parts: string[]): string | undefined {
    const dbIndex = parts.indexOf('db')
    const schemaIndex = parts.indexOf('schema')

    if (dbIndex !== -1 && schemaIndex !== -1 && dbIndex + 1 < parts.length && schemaIndex + 1 < parts.length) {
      return `${parts[dbIndex + 1]}/${parts[schemaIndex + 1]}`
    } else if (dbIndex !== -1 && dbIndex + 1 < parts.length) {
      return parts[dbIndex + 1]
    } else if (schemaIndex !== -1 && schemaIndex + 1 < parts.length) {
      return parts[schemaIndex + 1]
    }
    return undefined
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
          handleConnectionExpand(nodeData.connectionId)
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
