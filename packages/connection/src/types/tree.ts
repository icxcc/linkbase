import type { TreeOption } from 'naive-ui'

export type TreeNodeType = 
  | 'folder' 
  | 'connection' 
  | 'rootContainer' 
  | 'database' 
  | 'schema' 
  | 'category' 
  | 'table' 
  | 'view' 
  | 'materializedView' 
  | 'function' 
  | 'procedure' 
  | 'sequence' 
  | 'index' 
  | 'user' 
  | 'column' 
  | 'trigger' 
  | 'event' 
  | 'role' 
  | 'tablespace'

export interface TreeNodeData {
  nodeType: TreeNodeType
  connectionId?: string
  driverType?: string
  databaseName?: string
  schemaName?: string
  tableName?: string
  columnName?: string
  categoryKey?: string
}

export const NODE_DATA_KEY = '__treeNodeData__'

export interface TreeOptionWithMeta extends TreeOption {
  [NODE_DATA_KEY]?: TreeNodeData
}

export interface ConnectionTreeNode {
  connId: string
  expanded: boolean
  loading: boolean
  children?: TreeOptionWithMeta[]
}