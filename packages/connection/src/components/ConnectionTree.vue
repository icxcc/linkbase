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
        :render-label="renderLabel"
        :render-prefix="renderPrefix"
        block-line
        selectable
        :draggable="true"
        :allow-drop="allowDrop"
        @update:expanded-keys="onExpandedKeysChange"
        @update:selected-keys="onSelectedKeysChange"
        @drop="onDrop"
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
import { ref, computed, watch, h, onMounted } from 'vue'
import { NTree, NInput, NButton, NIcon, NTag, NText, TreeOption, TreeDropInfo } from 'naive-ui'
import {
  ServerOutline, FolderOutline, FolderOpenOutline, TableOutline, EyeOutline,
  FunctionOutline, CubeOutline, KeyOutline, PersonOutline, LayersOutline,
  SearchOutline, AddOutline, CellphoneOutline, FlashOutline
} from '@vicons/ionicons5'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { useEditorStore } from '@linkbase/core/stores/editor'
import { useResultStore } from '@linkbase/core/stores/result'
import { getEnhancedMetadata, getMetadata, executeSql, connect as connectApi, disconnect as disconnectApi, testConnection as testConnectionApi } from '@linkbase/core/api'
import type { DatabaseMetadata, DatabaseInfo, SchemaInfo, TableInfo, ViewInfo, RoutineInfo } from '@linkbase/core/api'
import { TREE_NODE_TEMPLATES, DRIVER_CONFIGS } from '../config/database-types'
import type { DriverType, TreeNodeTemplate, TreeNodeCategory } from '../config/database-types'
import { LContextMenu } from '@linkbase/components'
import type { ContextMenuItem } from '@linkbase/components'

const emit = defineEmits<{
  openCreateDialog: []
  editConnection: [connectionId: string]
  executeSql: [sql: string]
}>()

const connectionStore = useConnectionStore()
const editorStore = useEditorStore()
const resultStore = useResultStore()

const treeRef = ref<InstanceType<typeof NTree> | null>(null)
const searchText = ref('')
const expandedKeys = ref<string[]>([])
const selectedKeys = ref<string[]>([])
const connectionMetadata = ref<Map<string, DatabaseMetadata>>(new Map())

const contextMenu = ref<{
  show: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  contextData: Record<string, unknown>
}>({
  show: false,
  x: 0,
  y: 0,
  items: [],
  contextData: {},
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

function getNodeTypeIcon(nodeType: TreeNodeType): string {
  const iconMap: Record<string, string> = {
    folder: 'Folder',
    connection: 'Server',
    rootContainer: 'Layers',
    category: 'Folder',
    table: 'Table',
    view: 'Eye',
    materializedView: 'Cube',
    function: 'Function',
    procedure: 'Function',
    sequence: 'Flash',
    index: 'Key',
    user: 'Person',
    column: 'Cellphone',
  }
  return iconMap[nodeType] || 'Server'
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
  driverType: string,
  db: DatabaseInfo,
  schema: SchemaInfo,
  tables: TableInfo[],
  keyPrefix: string
): TreeOption[] {
  const children: TreeOption[] = []

  switch (category.key) {
    case 'tables': {
      const src = db.tables || schema.tables || tables
      if (src.length === 0) break
      for (const t of src) {
        const tKey = `${keyPrefix}/table/${t.name}`
        const colNodes: TreeOption[] = (t.columns || []).map((col) => ({
          key: `${tKey}/col/${col.name}`,
          label: `${col.name} (${col.data_type})`,
          isLeaf: true,
          nodeType: 'column' as TreeNodeType,
          children: undefined,
          prefix: () => h(NIcon, null, { default: () => h(CellphoneOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'column',
            connectionId,
            tableName: t.name,
            columnName: col.name,
            databaseName,
            schemaName,
          } as TreeNodeData,
        }))
        children.push({
          key: tKey,
          label: t.name,
          nodeType: 'table' as TreeNodeType,
          children: colNodes,
          prefix: () => h(NIcon, null, { default: () => h(TableOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'table',
            connectionId,
            tableName: t.name,
            databaseName,
            schemaName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'views': {
      const src = db.views || schema.views || []
      for (const v of src) {
        const vKey = `${keyPrefix}/view/${v.name}`
        children.push({
          key: vKey,
          label: v.name,
          isLeaf: true,
          nodeType: 'view' as TreeNodeType,
          prefix: () => h(NIcon, null, { default: () => h(EyeOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'view',
            connectionId,
            databaseName,
            schemaName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'materialized_views': {
      const src = schema.materialized_views || []
      for (const mv of src) {
        children.push({
          key: `${keyPrefix}/mv/${mv.name}`,
          label: mv.name,
          isLeaf: true,
          nodeType: 'materializedView' as TreeNodeType,
          prefix: () => h(NIcon, null, { default: () => h(CubeOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'materializedView',
            connectionId,
            schemaName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'functions': {
      const src = db.functions || schema.functions || []
      for (const f of src) {
        children.push({
          key: `${keyPrefix}/func/${f.name}`,
          label: f.name,
          isLeaf: true,
          nodeType: 'function' as TreeNodeType,
          prefix: () => h(NIcon, null, { default: () => h(FunctionOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'function',
            connectionId,
            databaseName,
            schemaName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'procedures': {
      const src = db.procedures || schema.procedures || []
      for (const p of src) {
        children.push({
          key: `${keyPrefix}/proc/${p.name}`,
          label: p.name,
          isLeaf: true,
          nodeType: 'procedure' as TreeNodeType,
          prefix: () => h(NIcon, null, { default: () => h(FunctionOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'procedure',
            connectionId,
            databaseName,
            schemaName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'sequences': {
      const src = schema.sequences || []
      for (const s of src) {
        children.push({
          key: `${keyPrefix}/seq/${s.name}`,
          label: s.name,
          isLeaf: true,
          nodeType: 'sequence' as TreeNodeType,
          prefix: () => h(NIcon, null, { default: () => h(FlashOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'sequence',
            connectionId,
            schemaName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'indexes': {
      const src = schema.indexes || []
      for (const idx of src) {
        children.push({
          key: `${keyPrefix}/idx/${idx.name}`,
          label: idx.name,
          isLeaf: true,
          nodeType: 'index' as TreeNodeType,
          prefix: () => h(NIcon, null, { default: () => h(KeyOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'index',
            connectionId,
            schemaName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'users': {
      const src = db.users || []
      for (const u of src) {
        children.push({
          key: `${keyPrefix}/user/${u.name}`,
          label: u.name,
          isLeaf: true,
          nodeType: 'user' as TreeNodeType,
          prefix: () => h(NIcon, null, { default: () => h(PersonOutline) }),
          [Symbol.for('nodeData')]: {
            nodeType: 'user',
            connectionId,
            databaseName,
          } as TreeNodeData,
        })
      }
      break
    }
    case 'tablespaces': {
      break
    }
  }

  return children
}

const treeData = computed<TreeOption[]>(() => {
  const data: TreeOption[] = []

  for (const group of connectionStore.connectionsByFolder) {
    if (group.folder) {
      data.push({
        key: `folder/${group.folder.id}`,
        label: group.folder.name,
        nodeType: 'folder' as TreeNodeType,
        prefix: () => h(NIcon, null, { default: () => h(FolderOutline) }),
        suffix: () => h(NTag, { size: 'tiny', round: true }, { default: () => String(group.connections.length) }),
        children: group.connections.map((c) => buildConnectionNode(c)),
        [Symbol.for('nodeData')]: { nodeType: 'folder' } as TreeNodeData,
      })
    } else {
      for (const c of group.connections) {
        data.push(buildConnectionNode(c))
      }
    }
  }

  return data
})

function buildConnectionNode(c: ConnectionStore['connections'][number]): TreeOption {
  const cfg = DRIVER_CONFIGS[c.driver_type as DriverType]
  const connected = c.status === 'connected'

  const node: TreeOption = {
    key: `conn/${c.id}`,
    label: c.name,
    nodeType: 'connection' as TreeNodeType,
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
    children: connected ? undefined : [],
    [Symbol.for('nodeData')]: {
      nodeType: 'connection',
      connectionId: c.id,
      driverType: c.driver_type,
    } as TreeNodeData,
    isLeaf: false,
  }

  if (connected) {
    node.children = []
  }

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

    const children: TreeOption[] = []

    if (template.rootContainerType === 'databases') {
      const databases = meta.databases || []
      for (const db of databases) {
        const dbKey = `conn/${connId}/db/${db.name}`
        const dbChildren: TreeOption[] = []
        for (const category of template.categories) {
          const catChildren = buildCategoryChildren(category, db.name, undefined, connId, c.driver_type, db, {} as SchemaInfo, [], dbKey)
          if (catChildren.length > 0) {
            dbChildren.push({
              key: `${dbKey}/cat/${category.key}`,
              label: category.label,
              nodeType: 'category' as TreeNodeType,
              children: catChildren,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            })
          }
        }
        children.push({
          key: dbKey,
          label: db.name,
          nodeType: 'rootContainer' as TreeNodeType,
          children: dbChildren,
          prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
          isLeaf: false,
        })
      }
    } else if (template.rootContainerType === 'schemas') {
      const schemas = meta.schemas || []
      for (const schema of schemas) {
        const schKey = `conn/${connId}/schema/${schema.name}`
        const schChildren: TreeOption[] = []
        for (const category of template.categories) {
          const catChildren = buildCategoryChildren(category, undefined, schema.name, connId, c.driver_type, {} as DatabaseInfo, schema, [], schKey)
          if (catChildren.length > 0) {
            schChildren.push({
              key: `${schKey}/cat/${category.key}`,
              label: category.label,
              nodeType: 'category' as TreeNodeType,
              children: catChildren,
              prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
              isLeaf: false,
            })
          }
        }
        children.push({
          key: schKey,
          label: schema.name,
          nodeType: 'rootContainer' as TreeNodeType,
          children: schChildren,
          prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
          isLeaf: false,
        })
      }
    } else {
      const tables = meta.tables || []
      for (const category of template.categories) {
        const catChildren = buildCategoryChildren(category, undefined, undefined, connId, c.driver_type, {} as DatabaseInfo, {} as SchemaInfo, tables, `conn/${connId}`)
        if (catChildren.length > 0) {
          children.push({
            key: `conn/${connId}/cat/${category.key}`,
            label: category.label,
            nodeType: 'category' as TreeNodeType,
            children: catChildren,
            prefix: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }),
            isLeaf: false,
          })
        }
      }
    }

    updateTreeNode(`conn/${connId}`, { children })
    expandedKeys.value = [...expandedKeys.value, `conn/${connId}`]
  } catch (err) {
    console.error('Failed to load metadata:', err)
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
  walk(treeData.value)
}

function onExpandedKeysChange(keys: string[]) {
  const newKeys = keys.filter((k) => !expandedKeys.value.includes(k))
  expandedKeys.value = keys

  for (const key of newKeys) {
    if (key.startsWith('conn/')) {
      const connId = key.replace('conn/', '').split('/')[0]
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

function getNodeData(node: TreeOption): TreeNodeData | undefined {
  return (node as Record<string, unknown>)[Symbol.for('nodeData')] as TreeNodeData | undefined
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
  let items: ContextMenuItem[] = []

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
        { key: 'connEdit', label: '编辑', icon: 'Create' },
        { key: 'connTest', label: '测试连接', icon: 'Pulse' },
        { key: 'connDelete', label: '删除', icon: 'Trash' },
        { key: 'connMoveTo', label: '移到分组...', icon: 'Folder' },
      ]
      break
    case 'table':
      items = [
        { key: 'generateSelect', label: '生成 SELECT', icon: 'Code' },
        { key: 'copyTableName', label: '复制表名', icon: 'Copy' },
        { key: 'copyDDL', label: '复制 DDL', icon: 'DocumentText' },
      ]
      break
    case 'view':
    case 'materializedView':
      items = [
        { key: 'generateSelect', label: '生成 SELECT', icon: 'Code' },
        { key: 'copyDDL', label: '复制 DDL', icon: 'DocumentText' },
      ]
      break
    case 'function':
    case 'procedure':
      items = [
        { key: 'generateCall', label: '生成调用语句', icon: 'Code' },
        { key: 'copyName', label: '复制名称', icon: 'Copy' },
      ]
      break
    default:
      break
  }

  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    items,
    contextData: { node, nodeData },
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
    contextData: {},
  }
}

function onContextMenuSelect(key: string) {
  const { nodeData } = contextMenu.value.contextData as { nodeData?: TreeNodeData }

  switch (key) {
    case 'newConnection':
    case 'newConnInFolder':
      emit('openCreateDialog')
      break
    case 'newFolder':
      prompt('分组名称:') && addFolder(prompt('分组名称:')!)
      break
    case 'renameFolder':
      if (nodeData) prompt('新名称:') && renameFolder(nodeData)
      break
    case 'deleteFolder':
      if (nodeData) deleteFolder(nodeData)
      break
    case 'connConnect':
      if (nodeData?.connectionId) handleConnect(nodeData.connectionId)
      break
    case 'connDisconnect':
      if (nodeData?.connectionId) handleDisconnect(nodeData.connectionId)
      break
    case 'connEdit':
      if (nodeData?.connectionId) emit('editConnection', nodeData.connectionId)
      break
    case 'connTest':
      if (nodeData?.connectionId) handleTestConnection(nodeData.connectionId)
      break
    case 'connDelete':
      if (nodeData?.connectionId) handleDeleteConnection(nodeData.connectionId)
      break
    case 'generateSelect': {
      const name = nodeData?.schemaName ? `${nodeData.schemaName}.${nodeData?.tableName || ''}` : (nodeData?.tableName || '')
      if (name) emit('executeSql', `SELECT * FROM ${name} LIMIT 100`)
      break
    }
    case 'copyTableName':
      if (nodeData?.tableName) navigator.clipboard.writeText(nodeData.tableName)
      break
    case 'generateCall': {
      const name = nodeData?.schemaName ? `${nodeData.schemaName}.${nodeData?.tableName || ''}` : (nodeData?.tableName || '')
      if (name) editorStore.updateTabSql(editorStore.activeTabId || '', `CALL ${name}()`)
      break
    }
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
    const name = nodeData.schemaName ? `${nodeData.schemaName}.${nodeData.tableName}` : (nodeData.tableName || '')
    if (name) emit('executeSql', `SELECT * FROM ${name} LIMIT 100`)
  } else if (nodeData.nodeType === 'view' || nodeData.nodeType === 'materializedView') {
    const name = nodeData.schemaName ? `${nodeData.schemaName}.${nodeData.tableName}` : (nodeData.tableName || '')
    if (name) emit('executeSql', `SELECT * FROM ${name} LIMIT 100`)
  }
}

function allowDrop({ node, dropPosition, dropNode }: { node: TreeOption; dropPosition: 'before' | 'inside' | 'after'; dropNode: TreeOption }) {
  const dragData = getNodeData(node)
  const dropData = getNodeData(dropNode)

  if (!dragData) return false

  if (dragData.nodeType === 'connection') {
    if (dropData?.nodeType === 'folder' && dropPosition === 'inside') return true
    if (
      (dropData?.nodeType === 'connection' || dropData?.nodeType === 'folder') &&
      dropPosition !== 'inside'
    ) return true
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
      connectionStore.moveToFolder(connId, (dropNode as Record<string, unknown>).key?.toString().replace('folder/', ''))
    }
  }
}

function addFolder(name: string) {
  if (!name.trim()) return
  connectionStore.addFolder(name.trim())
  expandedKeys.value.push(`folder/${connectionStore.folders[connectionStore.folders.length - 1].id}`)
}

function renameFolder(nodeData: TreeNodeData) {
  const folderId = contextMenu.value.contextData.node?.key?.toString().replace('folder/', '')
  if (folderId) {
    const name = prompt('新名称:')
    if (name?.trim()) connectionStore.renameFolder(folderId, name.trim())
  }
}

function deleteFolder(nodeData: TreeNodeData) {
  const folderId = contextMenu.value.contextData.node?.key?.toString().replace('folder/', '')
  if (folderId) connectionStore.removeFolder(folderId)
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
      password: c.options?.password as string,
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
      password: c.options?.password as string,
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

const renderLabel = ({ option }: { option: TreeOption }) => {
  const nodeData = getNodeData(option)
  if (!nodeData) return option.label as string

  if (nodeData.nodeType === 'connection') {
    const c = connectionStore.connections.find((x) => x.id === nodeData.connectionId)
    if (!c) return option.label as string
    return h('span', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
      h(NText, null, { default: () => option.label as string }),
      h(NTag, { size: 'tiny', round: true, type: getStatusTagType(c.status) }, { default: () => c.status }),
    ])
  }

  return option.label as string
}

function getStatusTagType(status: string): 'info' | 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'connected': return 'success'
    case 'connecting':
    case 'reconnecting': return 'warning'
    case 'error': return 'error'
    default: return 'default'
  }
}

const renderPrefix = ({ option }: { option: TreeOption }) => {
  const nodeData = getNodeData(option)
  if (!nodeData) return null
  return option.prefix ? (option.prefix as () => VNode)() : null
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
