import type { DriverType } from '@linkbase/core/api'
export type { DriverType }

export interface DriverFieldConfig {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'select' | 'file'
  defaultValue: string | number
  required: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
}

export interface DriverConfig {
  type: DriverType
  name: string
  defaultPort: number
  defaultUser: string
  connectionNameTemplate: string
  fields: DriverFieldConfig[]
}

export interface TreeNodeCategory {
  key: string
  label: string
  icon: string
}

export interface TreeNodeTemplate {
  rootContainerType: 'databases' | 'schemas' | 'flat' | 'databases_with_schemas'
  categories: TreeNodeCategory[]
  rootContainerLabel: string
  topLevelCategories?: TreeNodeCategory[]
}

export const DRIVER_CONFIGS: Record<DriverType, DriverConfig> = {
  sqlite: {
    type: 'sqlite',
    name: 'SQLite',
    defaultPort: 0,
    defaultUser: '',
    connectionNameTemplate: '@localhost',
    fields: [
      { key: 'name', label: '连接名称', type: 'text', defaultValue: '@localhost', required: true, placeholder: '连接名称' },
      { key: 'mode', label: '模式', type: 'select', defaultValue: 'file', required: true, options: [{ label: '文件', value: 'file' }, { label: '内存', value: 'memory' }] },
      { key: 'filePath', label: '文件路径', type: 'file', defaultValue: '', required: false, placeholder: '选择数据库文件' },
    ],
  },
  mysql: {
    type: 'mysql',
    name: 'MySQL',
    defaultPort: 3306,
    defaultUser: 'root',
    connectionNameTemplate: 'root@localhost',
    fields: [
      { key: 'name', label: '连接名称', type: 'text', defaultValue: 'root@localhost', required: true, placeholder: '连接名称' },
      { key: 'host', label: '主机', type: 'text', defaultValue: 'localhost', required: true, placeholder: 'localhost' },
      { key: 'port', label: '端口', type: 'number', defaultValue: 3306, required: true, placeholder: '3306' },
      { key: 'user', label: '用户名', type: 'text', defaultValue: 'root', required: false, placeholder: 'root' },
      { key: 'password', label: '密码', type: 'password', defaultValue: '', required: false, placeholder: '密码' },
      { key: 'database', label: '数据库', type: 'text', defaultValue: '', required: false, placeholder: '留空则管理所有数据库' },
      { key: 'charset', label: '字符集', type: 'select', defaultValue: 'utf8mb4', required: false, options: [
        { label: 'utf8mb4', value: 'utf8mb4' },
        { label: 'utf8', value: 'utf8' },
        { label: 'latin1', value: 'latin1' },
        { label: 'gbk', value: 'gbk' },
      ]},
    ],
  },
  postgres: {
    type: 'postgres',
    name: 'PostgreSQL',
    defaultPort: 5432,
    defaultUser: 'postgres',
    connectionNameTemplate: 'postgres@localhost',
    fields: [
      { key: 'name', label: '连接名称', type: 'text', defaultValue: 'postgres@localhost', required: true, placeholder: '连接名称' },
      { key: 'host', label: '主机', type: 'text', defaultValue: 'localhost', required: true, placeholder: 'localhost' },
      { key: 'port', label: '端口', type: 'number', defaultValue: 5432, required: true, placeholder: '5432' },
      { key: 'user', label: '用户名', type: 'text', defaultValue: 'postgres', required: false, placeholder: 'postgres' },
      { key: 'password', label: '密码', type: 'password', defaultValue: '', required: false, placeholder: '密码' },
      { key: 'database', label: '数据库', type: 'text', defaultValue: '', required: false, placeholder: '留空则管理所有数据库' },
      { key: 'sslmode', label: 'SSL 模式', type: 'select', defaultValue: 'prefer', required: false, options: [
        { label: 'disable', value: 'disable' },
        { label: 'allow', value: 'allow' },
        { label: 'prefer', value: 'prefer' },
        { label: 'require', value: 'require' },
        { label: 'verify-ca', value: 'verify-ca' },
        { label: 'verify-full', value: 'verify-full' },
      ]},
    ],
  },
  oracle: {
    type: 'oracle',
    name: 'Oracle',
    defaultPort: 1521,
    defaultUser: 'system',
    connectionNameTemplate: 'system@localhost',
    fields: [
      { key: 'name', label: '连接名称', type: 'text', defaultValue: 'system@localhost', required: true, placeholder: '连接名称' },
      { key: 'host', label: '主机', type: 'text', defaultValue: 'localhost', required: true, placeholder: 'localhost' },
      { key: 'port', label: '端口', type: 'number', defaultValue: 1521, required: true, placeholder: '1521' },
      { key: 'user', label: '用户名', type: 'text', defaultValue: 'system', required: false, placeholder: 'system' },
      { key: 'password', label: '密码', type: 'password', defaultValue: '', required: false, placeholder: '密码' },
      { key: 'serviceName', label: '服务名/SID', type: 'text', defaultValue: '', required: false, placeholder: '服务名或SID' },
    ],
  },
}

export const TREE_NODE_TEMPLATES: Record<DriverType, TreeNodeTemplate> = {
  sqlite: {
    rootContainerType: 'flat',
    rootContainerLabel: '',
    categories: [
      { key: 'tables', label: 'Tables', icon: 'table' },
      { key: 'views', label: 'Views', icon: 'eye' },
    ],
  },
  mysql: {
    rootContainerType: 'databases',
    rootContainerLabel: 'Databases',
    categories: [
      { key: 'tables', label: 'Tables', icon: 'table' },
      { key: 'views', label: 'Views', icon: 'eye' },
      { key: 'functions', label: 'Functions', icon: 'function' },
      { key: 'procedures', label: 'Stored Procedures', icon: 'procedure' },
      { key: 'triggers', label: 'Triggers', icon: 'trigger' },
      { key: 'events', label: 'Events', icon: 'event' },
    ],
    topLevelCategories: [
      { key: 'users', label: 'Users', icon: 'user' },
    ],
  },
  postgres: {
    rootContainerType: 'databases_with_schemas',
    rootContainerLabel: 'Databases',
    categories: [
      { key: 'tables', label: 'Tables', icon: 'table' },
      { key: 'views', label: 'Views', icon: 'eye' },
      { key: 'materialized_views', label: 'Materialized Views', icon: 'materialized-view' },
      { key: 'functions', label: 'Functions', icon: 'function' },
      { key: 'procedures', label: 'Procedures', icon: 'procedure' },
      { key: 'sequences', label: 'Sequences', icon: 'sequence' },
      { key: 'indexes', label: 'Indexes', icon: 'index' },
      { key: 'triggers', label: 'Triggers', icon: 'trigger' },
      { key: 'events', label: 'Events', icon: 'event' },
    ],
    topLevelCategories: [
      { key: 'roles', label: 'Roles', icon: 'role' },
      { key: 'tablespaces', label: 'Tablespaces', icon: 'tablespace' },
    ],
  },
  oracle: {
    rootContainerType: 'schemas',
    rootContainerLabel: 'Schemas',
    categories: [
      { key: 'tables', label: 'Tables', icon: 'table' },
      { key: 'views', label: 'Views', icon: 'eye' },
      { key: 'materialized_views', label: 'Materialized Views', icon: 'materialized-view' },
      { key: 'functions', label: 'Functions', icon: 'function' },
      { key: 'procedures', label: 'Procedures', icon: 'procedure' },
      { key: 'sequences', label: 'Sequences', icon: 'sequence' },
      { key: 'indexes', label: 'Indexes', icon: 'index' },
      { key: 'users', label: 'Users', icon: 'user' },
      { key: 'tablespaces', label: 'Tablespaces', icon: 'tablespace' },
    ],
  },
}
