import { h } from 'vue'
import { NIcon, type TreeOption } from 'naive-ui'
import {
  ServerOutline, FolderOutline, FolderOpenOutline, GridOutline, EyeOutline,
  CodeSlashOutline, CubeOutline, KeyOutline, PersonOutline, LayersOutline,
  FlashOutline, WarningOutline, AlertCircleOutline, PeopleOutline, DocumentsOutline,
  TabletLandscapeOutline
} from '@vicons/ionicons5'
import type { Connection } from '@linkbase/core/stores/connection'
import type { DatabaseMetadata, DatabaseInfo, SchemaInfo, TableInfo } from '@linkbase/core/api'
import type { TreeNodeCategory } from '../config/database-types'
import type { TreeNodeData, TreeNodeType, TreeOptionWithMeta } from '../types/tree'
import { NODE_DATA_KEY } from '../types/tree'

export function setNodeData(node: TreeOptionWithMeta, data: TreeNodeData): void {
  node[NODE_DATA_KEY] = data
}

export function getNodeData(node: TreeOption): TreeNodeData | undefined {
  return (node as TreeOptionWithMeta)[NODE_DATA_KEY]
}

export function getStatusColor(status: string): string {
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

export function buildConnectionNode(c: Connection): TreeOptionWithMeta {
  const iconColor = c.status === 'connected' ? '#18a058'
    : c.status === 'connecting' ? '#f0a020'
    : c.status === 'error' ? '#d03050'
    : '#909399'

  const isLoading = c.status === 'connecting'

  const node: TreeOptionWithMeta = {
    key: `conn/${c.id}`,
    label: c.name,
    isLoading,
    prefix: () => h(NIcon, { color: iconColor }, { default: () => h(ServerOutline) }),
    isLeaf: false,
    children: [],
  }

  setNodeData(node, {
    nodeType: 'connection',
    connectionId: c.id,
    driverType: c.driver_type,
  })

  return node
}

export function buildCategoryChildren(
  category: TreeNodeCategory,
  databaseName: string | undefined,
  schemaName: string | undefined,
  connectionId: string,
  db: DatabaseInfo,
  schema: SchemaInfo,
  tables: TableInfo[],
  keyPrefix: string,
  meta?: DatabaseMetadata
): TreeOptionWithMeta[] {
  const children: TreeOptionWithMeta[] = []

  switch (category.key) {
    case 'tables': {
      const src = (db.tables && db.tables.length > 0) ? db.tables : ((schema.tables && schema.tables.length > 0) ? schema.tables : tables)
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
      const src = meta?.users || db.users || []
      for (const u of src) {
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
    case 'triggers': {
      const src = (db.triggers && db.triggers.length > 0) ? db.triggers : (schema.triggers || [])
      for (const t of src) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/trigger/${t.name}`,
          label: t.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(WarningOutline) }),
        }
        setNodeData(node, {
          nodeType: 'trigger',
          connectionId,
          databaseName,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'events': {
      const src = (db.events && db.events.length > 0) ? db.events : (schema.events || [])
      for (const e of src) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/event/${e.name}`,
          label: e.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(AlertCircleOutline) }),
        }
        setNodeData(node, {
          nodeType: 'event',
          connectionId,
          databaseName,
          schemaName,
        })
        children.push(node)
      }
      break
    }
    case 'roles': {
      const src = meta?.roles || []
      for (const r of src) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/role/${r.name}`,
          label: r.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(PeopleOutline) }),
        }
        setNodeData(node, {
          nodeType: 'role',
          connectionId,
        })
        children.push(node)
      }
      break
    }
    case 'tablespaces': {
      const src = meta?.tablespaces || []
      for (const t of src) {
        const node: TreeOptionWithMeta = {
          key: `${keyPrefix}/tablespace/${t.name}`,
          label: t.name,
          isLeaf: true,
          prefix: () => h(NIcon, null, { default: () => h(DocumentsOutline) }),
        }
        setNodeData(node, {
          nodeType: 'tablespace',
          connectionId,
        })
        children.push(node)
      }
      break
    }
  }

  return children
}

export function hasCategoryItems(
  categoryKey: string,
  db: DatabaseInfo,
  schema: SchemaInfo,
  meta?: DatabaseMetadata
): boolean {
  switch (categoryKey) {
    case 'tables':
      return (db.tables?.length || schema.tables?.length || 0) > 0
    case 'views':
      return (db.views?.length || schema.views?.length || 0) > 0
    case 'materialized_views':
      return (schema.materialized_views?.length || 0) > 0
    case 'functions':
      return (db.functions?.length || schema.functions?.length || 0) > 0
    case 'procedures':
      return (db.procedures?.length || schema.procedures?.length || 0) > 0
    case 'sequences':
      return (schema.sequences?.length || 0) > 0
    case 'indexes':
      return (schema.indexes?.length || 0) > 0
    case 'users':
      return (meta?.users?.length || db.users?.length || 0) > 0
    case 'triggers':
      return (db.triggers?.length || schema.triggers?.length || 0) > 0
    case 'events':
      return (db.events?.length || schema.events?.length || 0) > 0
    case 'roles':
      return (meta?.roles?.length || 0) > 0
    case 'tablespaces':
      return (meta?.tablespaces?.length || 0) > 0
    default:
      return true
  }
}