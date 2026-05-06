<template>
  <div class="connection-tree" @contextmenu.prevent="onPanelContextMenu">
    <div class="tree-toolbar">
      <n-input
        v-model:value="searchText"
        :placeholder="$t('connection.searchPlaceholder')"
        clearable
        size="small"
      >
        <template #prefix>
          <n-icon><SearchOutline /></n-icon>
        </template>
      </n-input>
      <n-button size="small" quaternary @click="$emit('openCreateDialog')" :title="$t('connection.newConnection')">
        <template #icon><n-icon><AddOutline /></n-icon></template>
      </n-button>
    </div>

    <div class="tree-content">
      <n-tree
        ref="treeRef"
        :data="treeData"
        :expanded-keys="expandedKeys"
        :selected-keys="selectedKeys"
        :pattern="searchText"
        :node-props="nodeProps"
        block-line
        selectable
        :draggable="true"
        :allow-drop="allowDrop as any"
        @update:expanded-keys="onExpandedKeysChange"
        @update:selected-keys="onSelectedKeysChange"
        @drop="onDrop as any"
        @dblclick="onNodeDblClick"
        virtual-scroll
        style="height: 100%"
      />
    </div>

    <LContextMenu
      v-if="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @close="contextMenu.show = false"
      @select="onContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { NTree, NInput, NButton, NIcon, NTag, type TreeOption } from 'naive-ui'
import {
  ServerOutline, FolderOutline, FolderOpenOutline, GridOutline, EyeOutline,
  CodeSlashOutline, CubeOutline, KeyOutline, PersonOutline, LayersOutline,
  SearchOutline, AddOutline, TabletLandscapeOutline, FlashOutline
} from '@vicons/ionicons5'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import type { Connection } from '@linkbase/core/stores/connection'
import { getEnhancedMetadata, connect as connectApi, disconnect as disconnectApi, testConnection as testConnectionApi } from '@linkbase/core/api'
import type { DatabaseMetadata, DatabaseInfo, SchemaInfo, TableInfo } from '@linkbase/core/api'
import { TREE_NODE_TEMPLATES } from '../config/database-types'
import type { DriverType, TreeNodeCategory } from '../config/database-types'
import { LContextMenu } from '@linkbase/components'

const emit = defineEmits<{
  openCreateDialog: []
  openEditDialog: [connectionId: string]
  executeSql: [sql: string]
}>()

const connectionStore = useConnectionStore()

const treeRef = ref<InstanceType<typeof NTree> | null>(null)
const searchText = ref('')
const expandedKeys = ref<string[]>([])
const selectedKeys = ref<string[]>([])
const connectionMetadata = ref<Map<string, DatabaseMetadata>>(new Map())

const contextMenu = ref<{
  show: boolean
  x: number
  y: number
  items: { key: string; label: string; icon?: string }[]
  contextNodeKey?: string
  contextNodeData?: TreeNodeData
}>({
  show: false,
  x: 0,
  y: 0,
  items: [],
  contextNodeKey: undefined,
  contextNodeData: undefined,
})

type TreeNodeType = 'folder' | 'connection' | 'rootContainer' | 'category' | 'table' | 'view' | 'materializedView' | 'function' | 'procedure' | 'sequence' | 'index' | 'user' | 'column'

interface TreeNodeData {
  nodeType: TreeNodeType
  connectionId?: string
  driverType?: string
  databaseName?: string
  schemaName?: string
  tableName?: string
  columnName?: string
}

const NODE_DATA_KEY = '__treeNodeData__'

interface TreeOptionWithMeta extends TreeOption {
  [NODE_DATA_KEY]?: TreeNodeData
}

function setNodeData(node: TreeOptionWithMeta, data: TreeNodeData) {
  node[NODE_DATA_KEY] = data
}

function getNodeData(node: TreeOption): TreeNodeData | undefined {
  return (node as TreeOptionWithMeta)[NODE_DATA_KEY]
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    connected: '#18a058',
    connecting: '#f0a020',
    disconnected: '#909399',
    reconnecting: '#f0a020',
    error: '#d03050',
    idle: '#909399',
  }
  return colors[status] || '#909399'
}

function buildCategoryChildren(
  category: TreeNodeCategory,
  databaseName: string | undefined,
  schemaName: string | undefined,
  connectionId: string,
  db: DatabaseInfo,
  schema: SchemaInfo,
  tables: TableInfo[],
  keyPrefix: string
): TreeOptionWithMeta[] {
  const children: TreeOptionWithMeta[] = []

  switch (category.key) {
    case 'tables': {
      const src = (db.tables && db.tables.length > 0) ? db.tables : ((schema.tables && schema.tables.length > 0) ? schema.tables : tables)
      if (!src || src.length === 0) break
      for (const t of src) {
        const tKey = `${keyPrefix}/table/${t.name}`
        const colNodes: TreeOptionWithMeta[] = (t.columns || []).map((col) => {
          const node: TreeOptionWithMeta = {
            key: `${tKey}/col/${col.name}`,
            label: `${col.name} (${col.data_type})`,
            isLeaf: true,
            prefix: () => h(NIcon, null, { default: () => h(TabletLandscapeOutline) }),
          }
          setNodeData(node, {
            nodeType: 'column',
            connectionId,
            tableName: t.name,
            columnName: col.name,
            databaseName,
            schemaName,
          })
          return node
        })
        const tableNode: TreeOptionWithMeta = {
          key: tKey,
          label: t.name,
          children: colNodes,
          prefix: () => h(NIcon, null, { default: () => h(GridOutline) }),
        }
        setNodeData(tableNode, {
          nodeType: 'table',
          connectionId,
          tableName: t.name,
          databaseName,
          schemaName,
        })
        children.push(tableNode)
      }
      break
    }
    case 'views': {
      const src = (db.views && db.views.length > 0) ? db.views : (schema.views || [])
      for (const v of src) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/view/${v.name}`,
          label: v.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(EyeOutline) }),
        }
        setNodeData(node, {
          nodeType: 'view',
          connectionId,
          databaseName,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'materialized_views': {
      for (const mv of (schema.materialized_views || [])) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/mv/${mv.name}`,
          label: mv.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(CubeOutline) }),
        }
        setNodeData(node, {
          nodeType: 'materializedView',
          connectionId,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'functions': {
      const src = (db.functions && db.functions.length > 0) ? db.functions : (schema.functions || [])
      for (const f of src) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/func/${f.name}`,
          label: f.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(CodeSlashOutline) }),
        }
        setNodeData(node, {
          nodeType: 'function',
          connectionId,
          databaseName,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'procedures': {
      const src = (db.procedures && db.procedures.length > 0) ? db.procedures : (schema.procedures || [])
      for (const p of src) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/proc/${p.name}`,
          label: p.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(CodeSlashOutline) }),
        }
        setNodeData(node, {
          nodeType: 'procedure',
          connectionId,
          databaseName,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'sequences': {
      for (const s of (schema.sequences || [])) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/seq/${s.name}`,
          label: s.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(FlashOutline) }),
        }
        setNodeData(node, {
          nodeType: 'sequence',
          connectionId,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'indexes': {
      for (const idx of (schema.indexes || [])) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/idx/${idx.name}`,
          label: idx.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(KeyOutline) }),
        }
        setNodeData(node, {
          nodeType: 'index',
          connectionId,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'users': {
      for (const u of (db.users || [])) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/user/${u.name}`,
          label: u.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(PersonOutline) }),
        }
        setNodeData(node, {
          nodeType: 'user',
          connectionId,
          databaseName,
        })
        children.push(node)
      }
      break
    }
  }

  return children
}

const treeData = computed<TreeOptionWithMeta[]>(() => {
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

  return data
})

function buildConnectionNode(c: Connection): TreeOptionWithMeta {
  const connected = c.status === 'connected'

  const node: TreeOptionWithMeta = {
    key: `conn/${c.id}`,
    label: c.name,
    prefix: () => h(NIcon, null, { default: () => h(ServerOutline) }),
    suffix: () => h('span', {
      style: {
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: getStatusColor(c.status),
        marginLeft: '6px',
      }
    }),
    isLeaf: false,
  }

  if (connected) {
    node.children = []
  }

  setNodeData(node, {
    nodeType: 'connection',
    connectionId: c.id,
    driverType: c.driver_type,
  })

  return node
}

async function loadConnectionChildren(connId: string): Promise<void> {
  const c = connectionStore.connections.find((x) => x.id === connId)
  if (!c || c.status !== 'connected') return

  try {
    const meta = await getEnhancedMetadata(connId)
    connectionMetadata.value.set(connId, meta)

    const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
    if (!template) return

    const children: TreeOptionWithMeta[] = []

    if (template.rootContainerType === 'databases') {
      const databases = meta.databases || []
      for (const db of databases) {
        const dbKey = `conn/${connId}/db/${db.name}`
        const dbChildren: TreeOptionWithMeta[] = []
        for (const category of template.categories) {
          const catChildren = buildCategoryChildren(category, db.name, undefined, connId, db, {} as SchemaInfo, [], dbKey)
          if (catChildren.length > 0) {
            const catNode: TreeOptionWithMeta = {
              key: `${dbKey}/cat/${category.key}`,
              label: category.label,
              children: catChildren,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            }
            dbChildren.push(catNode)
          }
        }
        const dbNode: TreeOptionWithMeta = {
          key: dbKey,
          label: db.name,
          children: dbChildren,
          prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
          isLeaf: false,
        }
        children.push(dbNode)
      }
    } else if (template.rootContainerType === 'schemas') {
      const schemas = meta.schemas || []
      for (const schema of schemas) {
        const schKey = `conn/${connId}/schema/${schema.name}`
        const schChildren: TreeOptionWithMeta[] = []
        for (const category of template.categories) {
          const catChildren = buildCategoryChildren(category, undefined, schema.name, connId, {} as DatabaseInfo, schema, [], schKey)
          if (catChildren.length > 0) {
            const catNode: TreeOptionWithMeta = {
              key: `${schKey}/cat/${category.key}`,
              label: category.label,
              children: catChildren,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            }
            schChildren.push(catNode)
          }
        }
        const schNode: TreeOptionWithMeta = {
          key: schKey,
          label: schema.name,
          children: schChildren,
          prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
          isLeaf: false,
        }
        children.push(schNode)
      }
    } else {
      const tables = meta.tables || []
      for (const category of template.categories) {
        const catChildren = buildCategoryChildren(category, undefined, undefined, connId, {} as DatabaseInfo, {} as SchemaInfo, tables, `conn/${connId}`)
        if (catChildren.length > 0) {
          const catNode: TreeOptionWithMeta = {
            key: `conn/${connId}/cat/${category.key}`,
            label: category.label,
            children: catChildren,
            prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
            isLeaf: false,
          }
          children.push(catNode)
        }
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

    if (template.rootContainerType === 'databases') {
      const databases = meta.databases || []
      for (const db of databases) {
        const dbKey = `conn/${connId}/db/${db.name}`
        const dbChildren: TreeOptionWithMeta[] = []
        for (const category of template.categories) {
          const catChildren = buildCategoryChildren(category, db.name, undefined, connId, db, {} as SchemaInfo, [], dbKey)
          if (catChildren.length > 0) {
            const catNode: TreeOptionWithMeta = {
              key: `${dbKey}/cat/${category.key}`,
              label: category.label,
              children: catChildren,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            }
            dbChildren.push(catNode)
          }
        }
        const dbNode: TreeOptionWithMeta = {
          key: dbKey,
          label: db.name,
          children: dbChildren,
          prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
          isLeaf: false,
        }
        children.push(dbNode)
      }
    } else if (template.rootContainerType === 'schemas') {
      const schemas = meta.schemas || []
      for (const schema of schemas) {
        const schKey = `conn/${connId}/schema/${schema.name}`
        const schChildren: TreeOptionWithMeta[] = []
        for (const category of template.categories) {
          const catChildren = buildCategoryChildren(category, undefined, schema.name, connId, {} as DatabaseInfo, schema, [], schKey)
          if (catChildren.length > 0) {
            const catNode: TreeOptionWithMeta = {
              key: `${schKey}/cat/${category.key}`,
              label: category.label,
              children: catChildren,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            }
            schChildren.push(catNode)
          }
        }
        const schNode: TreeOptionWithMeta = {
          key: schKey,
          label: schema.name,
          children: schChildren,
          prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
          isLeaf: false,
        }
        children.push(schNode)
      }
    } else {
      const tables = meta.tables || []
      for (const category of template.categories) {
        const catChildren = buildCategoryChildren(category, undefined, undefined, connId, {} as DatabaseInfo, {} as SchemaInfo, tables, `conn/${connId}`)
        if (catChildren.length > 0) {
          const catNode: TreeOptionWithMeta = {
            key: `conn/${connId}/cat/${category.key}`,
            label: category.label,
            children: catChildren,
            prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
            isLeaf: false,
          }
          children.push(catNode)
        }
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
      const c = connectionStore.connections.find((x) => x.id === connId)
      if (c && c.status === 'connected') {
        loadConnectionChildren(connId)
      }
    }
  }
}

function onSelectedKeysChange(keys: string[]) {
  selectedKeys.value = keys
}

function nodeProps({ option }: { option: TreeOption }) {
  const nodeData = getNodeData(option)
  return {
    onContextmenu(e: MouseEvent) {
      e.preventDefault()
      showContextMenu(e, option, nodeData)
    },
  }
}

function showContextMenu(e: MouseEvent, node: TreeOption, nodeData?: TreeNodeData) {
  const type = nodeData?.nodeType || 'unknown'
  let items: { key: string; label: string; icon?: string }[] = []

  switch (type) {
    case 'folder':
      items = [
        { key: 'newConnInFolder', label: '新建连接', icon: 'Add' },
        { key: 'renameFolder', label: '重命名', icon: 'Create' },
        { key: 'deleteFolder', label: '删除分组', icon: 'Trash' },
      ]
      break
    case 'connection':
      items = [
        { key: 'connConnect', label: '连接', icon: 'Link' },
        { key: 'connDisconnect', label: '断开', icon: 'Unlink' },
        { key: 'connEdit', label: '编辑', icon: 'Edit' },
        { key: 'connRefresh', label: '刷新', icon: 'Refresh' },
        { key: 'connTest', label: '测试连接', icon: 'Pulse' },
        { key: 'connDelete', label: '删除', icon: 'Trash' },
      ]
      break
    case 'table':
      items = [
        { key: 'generateSelect', label: '生成 SELECT', icon: 'Code' },
        { key: 'copyTableName', label: '复制表名', icon: 'Copy' },
      ]
      break
    case 'view':
    case 'materializedView':
      items = [
        { key: 'generateSelect', label: '生成 SELECT', icon: 'Code' },
      ]
      break
    case 'function':
    case 'procedure':
      items = [
        { key: 'copyName', label: '复制名称', icon: 'Copy' },
      ]
      break
  }

  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    items,
    contextNodeKey: node.key as string,
    contextNodeData: nodeData,
  }
}

function onPanelContextMenu(e: MouseEvent) {
  e.preventDefault()
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

function onContextMenuSelect(key: string) {
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
      if (nodeData?.connectionId) handleConnect(nodeData.connectionId)
      break
    case 'connDisconnect':
      if (nodeData?.connectionId) handleDisconnect(nodeData.connectionId)
      break
    case 'connEdit':
      if (nodeData?.connectionId) emit('openEditDialog', nodeData.connectionId)
      break
    case 'connRefresh':
      if (nodeData?.connectionId) refreshConnection(nodeData.connectionId)
      break
    case 'connTest':
      if (nodeData?.connectionId) handleTestConnection(nodeData.connectionId)
      break
    case 'connDelete':
      if (nodeData?.connectionId) handleDeleteConnection(nodeData.connectionId)
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

function onNodeDblClick(_e: MouseEvent, node: TreeOption) {
  const nodeData = getNodeData(node)
  if (!nodeData) return

  if (nodeData.nodeType === 'table') {
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

function allowDrop({ node, dropPosition, dropNode }: { node: TreeOption; dropPosition: 'before' | 'inside' | 'after'; dropNode: TreeOption }) {
  const dragData = getNodeData(node)
  const dropData = getNodeData(dropNode)

  if (!dragData) return false

  if (dragData.nodeType === 'connection') {
    if (dropData?.nodeType === 'folder' && dropPosition === 'inside') return true
    if ((dropData?.nodeType === 'connection' || dropData?.nodeType === 'folder') && dropPosition !== 'inside') return true
    return false
  }

  if (dragData.nodeType === 'folder') {
    if (dropPosition !== 'inside') return true
    return false
  }

  return false
}

function onDrop({ node, dropPosition, dropNode }: { node: TreeOption; dropPosition: 'before' | 'inside' | 'after'; dropNode: TreeOption }) {
  const dragData = getNodeData(node)
  const dropData = getNodeData(dropNode)

  if (!dragData) return

  if (dragData.nodeType === 'connection') {
    const connId = dragData.connectionId
    if (!connId) return

    if (dropData?.nodeType === 'folder' && dropPosition === 'inside') {
      const folderId = String(dropNode.key).replace('folder/', '')
      connectionStore.moveToFolder(connId, folderId)
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

async function handleConnect(connId: string) {
  const c = connectionStore.connections.find((x) => x.id === connId)
  if (!c) return

  connectionStore.updateConnectionStatus(connId, 'connecting')
  try {
    const config = {
      driver_type: c.driver_type,
      host: c.host,
      port: c.port,
      user: c.user || c.username,
      password: c.options?.password as string | undefined,
      database: c.database,
      connection_string: c.connection_string,
      options: c.options || {},
    }
    const backendId = await connectApi(config)
    connectionStore.updateConnection(connId, { id: backendId, status: 'connected' })
    connectionStore.setCurrentConnection(backendId)
  } catch (err) {
    connectionStore.updateConnectionStatus(connId, 'error')
    console.error('Connection failed:', err)
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
    const config = {
      driver_type: c.driver_type,
      host: c.host,
      port: c.port,
      user: c.user || c.username,
      password: c.options?.password as string | undefined,
      database: c.database,
      connection_string: c.connection_string,
      options: c.options || {},
    }
    const result = await testConnectionApi(config)
    alert(`连接成功!\n服务器版本: ${result.server_version}\n延迟: ${result.latency_ms.toFixed(1)}ms`)
  } catch (err) {
    alert(`连接失败: ${err}`)
  }
}

function handleDeleteConnection(connId: string) {
  if (confirm('确定要删除此连接吗?')) {
    connectionStore.removeConnection(connId)
  }
}
</script>

<style scoped>
.connection-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.tree-toolbar :deep(.n-input) {
  flex: 1;
}

.tree-content {
  flex: 1;
  overflow: auto;
  padding: 4px 0;
}
</style>
