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
        virtual-scroll
        style="height: 100%"
      />
    </div>

    <LContextMenu
      :show="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @close="contextMenu.show = false"
      @select="onContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
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
const treeData = ref<TreeOptionWithMeta[]>([])

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

refreshTreeData()
connectionStore.$subscribe(() => {
  refreshTreeData()
})

type TreeNodeType = 'folder' | 'connection' | 'rootContainer' | 'database' | 'schema' | 'category' | 'table' | 'view' | 'materializedView' | 'function' | 'procedure' | 'sequence' | 'index' | 'user' | 'column'

interface TreeNodeData {
  nodeType: TreeNodeType
  connectionId?: string
  driverType?: string
  databaseName?: string
  schemaName?: string
  tableName?: string
  columnName?: string
  categoryKey?: string
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
          const hasItems = hasCategoryItems(category.key, db, {} as SchemaInfo)
          if (hasItems) {
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
        }
        const dbNode: TreeOptionWithMeta = {
          key: dbKey,
          label: db.name,
          children: dbChildren,
          prefix: () => h(NIcon, null, { default: () => h(GridOutline) }),
          isLeaf: false,
        }
        setNodeData(dbNode, { nodeType: 'database', connectionId: connId, databaseName: db.name })
        containerNode.children!.push(dbNode)
      }
      children.push(containerNode)
    } else if (template.rootContainerType === 'schemas') {
      const schemas = meta.schemas || []
      const containerNode: TreeOptionWithMeta = {
        key: `conn/${connId}/container`,
        label: template.rootContainerLabel,
        children: [],
        prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
        isLeaf: false,
      }
      setNodeData(containerNode, { nodeType: 'rootContainer', connectionId: connId })
      for (const schema of schemas) {
        const schKey = `conn/${connId}/container/schema/${schema.name}`
        const schChildren: TreeOptionWithMeta[] = []
        for (const category of template.categories) {
          const hasItems = hasCategoryItems(category.key, {} as DatabaseInfo, schema)
          if (hasItems) {
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
              schemaName: schema.name,
              categoryKey: category.key,
            })
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
        setNodeData(schNode, { nodeType: 'schema', connectionId: connId, schemaName: schema.name })
        containerNode.children!.push(schNode)
      }
      children.push(containerNode)
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

function hasCategoryItems(categoryKey: string, db: DatabaseInfo, schema: SchemaInfo): boolean {
  switch (categoryKey) {
    case 'tables':
      return !!(db.tables?.length) || !!(schema.tables?.length)
    case 'views':
      return !!(db.views?.length) || !!(schema.views?.length)
    case 'materialized_views':
      return !!(schema.materialized_views?.length)
    case 'functions':
      return !!(db.functions?.length) || !!(schema.functions?.length)
    case 'procedures':
      return !!(db.procedures?.length) || !!(schema.procedures?.length)
    case 'sequences':
      return !!(schema.sequences?.length)
    case 'indexes':
      return !!(schema.indexes?.length)
    case 'users':
      return !!(db.users?.length)
    default:
      return false
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
          const hasItems = hasCategoryItems(category.key, db, {} as SchemaInfo)
          if (hasItems) {
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
        }
        const dbNode: TreeOptionWithMeta = {
          key: dbKey,
          label: db.name,
          children: dbChildren,
          prefix: () => h(NIcon, null, { default: () => h(GridOutline) }),
          isLeaf: false,
        }
        setNodeData(dbNode, { nodeType: 'database', connectionId: connId, databaseName: db.name })
        containerNode.children!.push(dbNode)
      }
      children.push(containerNode)
    } else if (template.rootContainerType === 'schemas') {
      const schemas = meta.schemas || []
      const containerNode: TreeOptionWithMeta = {
        key: `conn/${connId}/container`,
        label: template.rootContainerLabel,
        children: [],
        prefix: () => h(NIcon, null, { default: () => h(LayersOutline) }),
        isLeaf: false,
      }
      setNodeData(containerNode, { nodeType: 'rootContainer', connectionId: connId })
      for (const schema of schemas) {
        const schKey = `conn/${connId}/container/schema/${schema.name}`
        const schChildren: TreeOptionWithMeta[] = []
        for (const category of template.categories) {
          const hasItems = hasCategoryItems(category.key, {} as DatabaseInfo, schema)
          if (hasItems) {
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
              schemaName: schema.name,
              categoryKey: category.key,
            })
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
        setNodeData(schNode, { nodeType: 'schema', connectionId: connId, schemaName: schema.name })
        containerNode.children!.push(schNode)
      }
      children.push(containerNode)
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
      
      if (parts.length === 1) {
        const c = connectionStore.connections.find((x) => x.id === connId)
        if (c && c.status === 'connected') {
          loadConnectionChildren(connId)
        }
      } else {
        const catIndex = parts.indexOf('cat')
        if (catIndex !== -1 && catIndex + 1 < parts.length) {
          const categoryKey = parts[catIndex + 1]
          const containerName = catIndex > 1 ? parts[catIndex - 1] : undefined
          loadCategoryChildren(connId, containerName, categoryKey)
        }
      }
    }
  }
}

async function loadCategoryChildren(connId: string, containerName: string | undefined, categoryKey: string) {
  const meta = connectionMetadata.value.get(connId)
  if (!meta) return

  const c = connectionStore.connections.find((x) => x.id === connId)
  if (!c) return

  const template = TREE_NODE_TEMPLATES[c.driver_type as DriverType]
  if (!template) return

  const category = template.categories.find((cat) => cat.key === categoryKey)
  if (!category) return

  let keyPrefix: string
  if (template.rootContainerType === 'flat') {
    keyPrefix = `conn/${connId}/cat/${categoryKey}`
  } else if (template.rootContainerType === 'databases') {
    keyPrefix = `conn/${connId}/container/db/${containerName}/cat/${categoryKey}`
  } else {
    keyPrefix = `conn/${connId}/container/schema/${containerName}/cat/${categoryKey}`
  }

  let db: DatabaseInfo = {} as DatabaseInfo
  let schema: SchemaInfo = {} as SchemaInfo

  if (template.rootContainerType === 'databases' && containerName) {
    db = meta.databases?.find((d) => d.name === containerName) || ({} as DatabaseInfo)
  } else if (containerName) {
    schema = meta.schemas?.find((s) => s.name === containerName) || ({} as SchemaInfo)
  }

  const catChildren = buildCategoryChildren(
    category,
    template.rootContainerType === 'databases' ? containerName : undefined,
    template.rootContainerType === 'schemas' ? containerName : undefined,
    connId,
    db,
    schema,
    [],
    keyPrefix
  )

  updateTreeNode(keyPrefix, { children: catChildren })
}

function onSelectedKeysChange(keys: string[]) {
  selectedKeys.value = keys
}

function nodeProps({ option }: { option: TreeOption }) {
  const nodeData = getNodeData(option)
  return {
    onContextmenu(e: MouseEvent) {
      e.preventDefault()
      e.stopPropagation()
      showContextMenu(e, option, nodeData)
    },
    ondblclick() {
      handleNodeDblClick(option)
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
        { key: 'connClone', label: '复制连接', icon: 'Copy' },
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
    case 'connClone':
      if (nodeData?.connectionId) handleCloneConnection(nodeData.connectionId)
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
    if (nodeData.connectionId) handleConnect(nodeData.connectionId)
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
      password: c.password || (c.options?.password as string | undefined),
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
      password: c.password || (c.options?.password as string | undefined),
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

function handleCloneConnection(connId: string) {
  const cloned = connectionStore.cloneConnection(connId)
  if (cloned) {
    emit('openEditDialog', cloned.id)
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
