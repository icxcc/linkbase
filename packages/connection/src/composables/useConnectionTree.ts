import { ref, shallowRef, watch } from 'vue'
import type { TreeOption } from 'naive-ui'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import type { Connection } from '@linkbase/core/stores/connection'
import { getEnhancedMetadata, connect as connectApi, disconnect as disconnectApi, testConnection as testConnectionApi } from '@linkbase/core/api'
import type { DatabaseMetadata, DatabaseInfo, SchemaInfo } from '@linkbase/core/api'
import { TREE_NODE_TEMPLATES } from '../config/database-types'
import type { DriverType } from '../config/database-types'
import type { TreeOptionWithMeta } from '../types/tree'
import { buildConnectionNode, setNodeData, getNodeData, buildCategoryChildren } from '../utils/treeUtils'
import { h } from 'vue'
import { NIcon, NTag } from 'naive-ui'
import {
  FolderOutline, FolderOpenOutline, LayersOutline, FlashOutline,
  AddOutline, SearchOutline
} from '@vicons/ionicons5'

export function useConnectionTree(emit: ReturnType<typeof defineEmits<{
  openCreateDialog: []
  openEditDialog: [connectionId: string]
  executeSql: [sql: string]
}>>) {
  const connectionStore = useConnectionStore()

  const treeData = ref<TreeOptionWithMeta[]>([])
  const expandedKeys = ref<string[]>([])
  const selectedKeys = ref<string[]>([])
  const searchText = ref('')
  const connectionMetadata = shallowRef<Map<string, DatabaseMetadata>>(new Map())

  const contextMenu = ref<{
    show: boolean
    x: number
    y: number
    items: { key: string; label: string; icon?: string }[]
    contextNodeKey?: string
    contextNodeData?: any
  }>({
    show: false,
    x: 0,
    y: 0,
    items: [],
    contextNodeKey: undefined,
    contextNodeData: undefined,
  })

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

    if (c.status === 'connecting') {
      return false
    }

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
    }
  }

  async function handleConnectionExpand(connId: string) {
    let c = connectionStore.connections.find((x) => x.id === connId)
    if (!c) return

    if (c.status === 'connected') {
      loadConnectionChildren(connId)
    } else if (c.status === 'connecting') {
      return
    } else {
      const success = await handleConnect(connId)
      if (success) {
        c = connectionStore.connections.find((x) => x.id === connId)
        if (c?.status === 'connected') {
          loadConnectionChildren(connId)
        }
      }
    }
  }

  async function handleDisconnect(connId: string) {
    try {
      await disconnectApi(connId)
      connectionStore.updateConnectionStatus(connId, 'disconnected')
      if (connectionStore.currentConnectionId === connId) {
        connectionStore.setCurrentConnection(null)
      }
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
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
        alert('Connection test successful!')
      } else {
        alert(`Connection test failed: ${result.error}`)
      }
    } catch (err) {
      alert(`Connection test failed: ${err}`)
    }
  }

  async function loadConnectionChildren(connId: string): Promise<void> {
    const c = connectionStore.connections.find((x) => x.id === connId)
    if (!c || c.status !== 'connected') return

    const loadingNode: TreeOptionWithMeta = {
      key: `conn/${connId}/loading`,
      label: 'Loading...',
      isLeaf: true,
      prefix: () => h(NIcon, null, { default: () => h(FlashOutline) }),
    }
    setNodeData(loadingNode, { nodeType: 'category', connectionId: connId })
    updateTreeNode(`conn/${connId}`, { children: [loadingNode] })

    try {
      const meta = await getEnhancedMetadata(connId)
      connectionMetadata.value.set(connId, meta)

      const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
      if (!template) return

      const children: TreeOptionWithMeta[] = []

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

      if (template.rootContainerType === 'databases') {
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
          for (const category of template.categories) {
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
            dbChildren.push(catNode)
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
        children.push(containerNode)
      } else if (template.rootContainerType === 'databases_with_schemas') {
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
            const schChildren: TreeOptionWithMeta[] = []
            for (const category of template.categories) {
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
              schChildren.push(catNode)
            }
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
        children.push(containerNode)
      } else {
        const tables = meta.tables || []
        for (const category of template.categories) {
          const catNode: TreeOptionWithMeta = {
            key: `conn/${connId}/cat/${category.key}`,
            label: category.label,
            children: [],
            prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
            isLeaf: false,
          }
          children.push(catNode)
        }
      }

      updateTreeNode(`conn/${connId}`, { children })
      if (!expandedKeys.value.includes(`conn/${connId}`)) {
        expandedKeys.value = [...expandedKeys.value, `conn/${connId}`]
      }
    } catch (err) {
      console.error('Failed to load metadata:', err)
    }
  }

  async function loadCategoryChildren(connId: string, containerName: string | undefined, categoryKey: string) {
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

    if (isTopLevel) {
      keyPrefix = `conn/${connId}/cat/${categoryKey}`
    } else if (template.rootContainerType === 'flat') {
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
    const children = buildCategoryChildrenForTree(categoryKey, connId, db, schema, tables, keyPrefix, meta)
    updateTreeNode(keyPrefix, { children })
  }

  function buildCategoryChildrenForTree(
    categoryKey: string,
    connId: string,
    db: DatabaseInfo,
    schema: SchemaInfo,
    tables: any[],
    keyPrefix: string,
    meta?: DatabaseMetadata
  ): TreeOptionWithMeta[] {
    return buildCategoryChildren(
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
  }

  async function refreshConnection(connId: string): Promise<void> {
    const c = connectionStore.connections.find((x) => x.id === connId)
    if (!c || c.status !== 'connected') return

    try {
      connectionMetadata.value.delete(connId)

      const meta = await getEnhancedMetadata(connId)
      connectionMetadata.value.set(connId, meta)

      const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
      if (!template) return

      const children: TreeOptionWithMeta[] = []

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

      if (template.rootContainerType === 'databases') {
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
          for (const category of template.categories) {
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
            dbChildren.push(catNode)
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
        children.push(containerNode)
      } else if (template.rootContainerType === 'databases_with_schemas') {
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
            const schChildren: TreeOptionWithMeta[] = []
            for (const category of template.categories) {
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
              schChildren.push(catNode)
            }
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
        children.push(containerNode)
      } else {
        const tables = meta.tables || []
        for (const category of template.categories) {
          const catNode: TreeOptionWithMeta = {
            key: `conn/${connId}/cat/${category.key}`,
            label: category.label,
            children: [],
            prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
            isLeaf: false,
          }
          children.push(catNode)
        }
      }

      updateTreeNode(`conn/${connId}`, { children })
    } catch (err) {
      console.error('Failed to refresh connection:', err)
    }
  }

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

  function onExpandedKeysChange(keys: string[]) {
    const newKeys = keys.filter((k) => !expandedKeys.value.includes(k))
    expandedKeys.value = keys

    for (const key of newKeys) {
      if (key.startsWith('conn/')) {
        const parts = key.replace('conn/', '').split('/')
        const connId = parts[0]

        if (parts.length === 1) {
          handleConnectionExpand(connId)
        } else {
          const catIndex = parts.indexOf('cat')
          if (catIndex !== -1 && catIndex + 1 < parts.length) {
            const categoryKey = parts[catIndex + 1]
            let containerName: string | undefined

            if (parts.includes('schema') && parts.includes('db')) {
              const dbIndex = parts.indexOf('db')
              const schemaIndex = parts.indexOf('schema')
              if (dbIndex !== -1 && schemaIndex !== -1 && dbIndex + 1 < parts.length && schemaIndex + 1 < parts.length) {
                containerName = `${parts[dbIndex + 1]}/${parts[schemaIndex + 1]}`
              }
            } else if (parts.includes('db')) {
              const dbIndex = parts.indexOf('db')
              if (dbIndex !== -1 && dbIndex + 1 < parts.length) {
                containerName = parts[dbIndex + 1]
              }
            } else if (parts.includes('schema')) {
              const schemaIndex = parts.indexOf('schema')
              if (schemaIndex !== -1 && schemaIndex + 1 < parts.length) {
                containerName = parts[schemaIndex + 1]
              }
            }

            loadCategoryChildren(connId, containerName, categoryKey)
          }
        }
      }
    }
  }

  function onSelectedKeysChange(keys: string[]) {
    selectedKeys.value = keys
  }

  function onPanelContextMenu(e: MouseEvent) {
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      items: [
        { key: 'newConnection', label: '新建连接', icon: 'Add' },
        { key: 'newFolder', label: '新建分组', icon: 'Folder' },
      ],
      contextNodeKey: undefined,
      contextNodeData: undefined,
    }
  }

  function onNodeContextMenu(e: MouseEvent, node: TreeOption) {
    const nodeData = getNodeData(node)
    e.preventDefault()

    const items: { key: string; label: string; icon?: string }[] = []

    if (nodeData?.nodeType === 'folder') {
      items.push(
        { key: 'renameFolder', label: '重命名' },
        { key: 'deleteFolder', label: '删除' }
      )
    } else if (nodeData?.nodeType === 'connection') {
      const conn = connectionStore.connections.find((c) => c.id === nodeData.connectionId)
      if (conn?.status === 'connected') {
        items.push(
          { key: 'connDisconnect', label: '断开连接' },
          { key: 'connRefresh', label: '刷新' },
          { key: 'connClone', label: '克隆连接' }
        )
      } else {
        items.push(
          { key: 'connConnect', label: '连接' },
          { key: 'connEdit', label: '编辑' },
          { key: 'connClone', label: '克隆连接' },
          { key: 'connTest', label: '测试连接' }
        )
      }
      items.push({ key: 'connDelete', label: '删除连接' })
    } else if (nodeData?.nodeType === 'table' || nodeData?.nodeType === 'view' || nodeData?.nodeType === 'materializedView') {
      items.push(
        { key: 'generateSelect', label: '生成 SELECT' },
        { key: 'copyTableName', label: '复制表名' }
      )
    } else if (nodeData?.nodeType === 'function' || nodeData?.nodeType === 'procedure') {
      items.push({ key: 'copyName', label: '复制名称' })
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
        const name = nodeData?.schemaName
          ? `${nodeData.schemaName}.${nodeData?.tableName || ''}`
          : (nodeData?.tableName || '')
        if (name) emit('executeSql', `SELECT * FROM ${name} LIMIT 100`)
        break
      }
      case 'copyTableName':
        if (nodeData?.tableName) navigator.clipboard.writeText(nodeData.tableName)
        break
      case 'copyName':
        if (nodeData?.tableName) navigator.clipboard.writeText(nodeData.tableName)
        break
    }

    contextMenu.value.show = false
  }

  function handleNodeDblClick(node: TreeOption) {
    const nodeData = getNodeData(node)
    if (!nodeData) return

    if (nodeData.nodeType === 'connection') {
      if (nodeData.connectionId) {
        const key = `conn/${nodeData.connectionId}`
        if (!expandedKeys.value.includes(key)) {
          expandedKeys.value = [...expandedKeys.value, key]
        } else {
          expandedKeys.value = expandedKeys.value.filter((k) => k !== key)
        }
      }
    } else if (nodeData.nodeType === 'table') {
      const name = nodeData.schemaName
        ? `${nodeData.schemaName}.${nodeData.tableName}`
        : (nodeData.tableName || '')
      if (name) emit('executeSql', `SELECT * FROM ${name} LIMIT 100`)
    } else if (nodeData.nodeType === 'view' || nodeData.nodeType === 'materializedView') {
      const name = nodeData.schemaName
        ? `${nodeData.schemaName}.${nodeData.tableName}`
        : (nodeData.tableName || '')
      if (name) emit('executeSql', `SELECT * FROM ${name} LIMIT 100`)
    }
  }

  function allowDrop({ node, dropPosition }: { node: TreeOption; dropPosition: 'before' | 'inside' | 'after'; phase: 'drag' | 'drop' }) {
    const targetData = getNodeData(node)

    if (targetData?.nodeType === 'folder' && dropPosition === 'inside') return true
    if ((targetData?.nodeType === 'connection' || targetData?.nodeType === 'folder') && dropPosition !== 'inside') return true
    return false
  }

  function onDrop({ node: dropNode, dragNode, dropPosition }: { node: TreeOption; dragNode: TreeOption; dropPosition: 'before' | 'inside' | 'after'; event: DragEvent }) {
    const dragKey = String(dragNode.key ?? '')

    if (dragKey.startsWith('conn/')) {
      const connId = dragKey.replace('conn/', '')
      if (!connId) return

      const dropData = getNodeData(dropNode)

      if (dropData?.nodeType === 'folder' && dropPosition === 'inside') {
        const folderId = String(dropNode.key).replace('folder/', '')
        connectionStore.moveToFolder(connId, folderId)
        refreshTreeData()
      }
    }
  }

  function addFolder() {
    const name = prompt('分组名称:')
    if (!name?.trim()) return
    connectionStore.addFolder(name.trim())
  }

  function renameFolder(nodeKey?: string) {
    if (!nodeKey) return
    const folderId = nodeKey.replace('folder/', '')
    const name = prompt('新名称:')
    if (name?.trim()) connectionStore.renameFolder(folderId, name.trim())
  }

  function deleteFolder(nodeKey?: string) {
    if (!nodeKey) return
    const folderId = nodeKey.replace('folder/', '')
    connectionStore.removeFolder(folderId)
  }

  function deleteConnection(connId: string) {
    if (confirm('确定要删除这个连接吗？')) {
      connectionStore.removeConnection(connId)
    }
  }

  function handleCloneConnection(connId: string) {
    const conn = connectionStore.connections.find((c) => c.id === connId)
    if (!conn) return

    const newConn = {
      ...conn,
      id: `${conn.id}-clone`,
      name: `${conn.name} (克隆)`,
    }
    connectionStore.addConnection(newConn)
  }

  const nodeProps = (node: TreeOption) => ({
    shouldExpand: false,
    'on-contextmenu': (e: MouseEvent) => onNodeContextMenu(e, node),
  })

  return {
    treeData,
    expandedKeys,
    selectedKeys,
    searchText,
    contextMenu,
    nodeProps,
    initTreeData,
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