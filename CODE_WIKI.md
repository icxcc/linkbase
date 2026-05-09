# LinkBase Code Wiki

## 1. 项目概述

**LinkBase** 是一款基于 **Tauri + Vue 3 + TypeScript** 构建的跨平台数据库管理工具。项目采用微前端架构，将前端代码拆分为多个独立包，后端使用 Rust 实现高性能数据库驱动层。

### 1.1 技术栈

| 层次    | 技术                  | 说明                                 |
| ----- | ------------------- | ---------------------------------- |
| 前端框架  | Vue 3               | Composition API + `<script setup>` |
| 状态管理  | Pinia               | 模块化状态管理                            |
| 路由    | Vue Router          | 单页应用路由                             |
| 构建工具  | Vite                | 快速开发构建                             |
| UI组件  | TailwindCSS + 自研组件库 | 扁平化设计风格                            |
| 编辑器   | Monaco Editor       | SQL 语法高亮与补全                        |
| 桌面框架  | Tauri               | 跨平台桌面应用                            |
| 后端语言  | Rust                | 高性能数据库驱动                           |
| 数据库驱动 | sqlx, rusqlite      | 原生驱动实现                             |

### 1.2 核心特性

- 支持 SQLite、MySQL、PostgreSQL 等关系型数据原生驱动
- 多标签页 SQL 编辑器
- 虚拟滚动高性能表格
- 连接分组管理
- 数据库对象树状浏览
- 国际化支持（中文/英文）
- 主题切换（亮色/暗色/系统）

***

## 2. 项目架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      LinkBase 应用                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Vue 3 前端应用                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  core    │ │editor    │ │connection│ │  result  │   │   │
│  │  │ (状态/API)│ │(编辑器)  │ │(连接管理)│ │(结果展示)│   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │   │
│  │       │            │            │            │          │   │
│  │       └────────────┴────┬───────┴────────────┘          │   │
│  │                         │                                │   │
│  │                   Tauri IPC                              │   │
│  │                         │                                │   │
│  └─────────────────────────┼─────────────────────────────────┘   │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Rust 后端 (Tauri)                          │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │          ConnectionManager                      │    │   │
│  │  │  (连接池管理、查询调度、会话管理)                 │    │   │
│  │  └───────────────────────────┬─────────────────────┘    │   │
│  │                              │                          │   │
│  │              ┌───────────────┼───────────────┐          │   │
│  │              ▼               ▼               ▼          │   │
│  │  ┌────────────────┐ ┌───────────────┐ ┌──────────────┐  │   │
│  │  │   SqliteDriver │ │  MySqlDriver  │ │PostgresDriver│  │   │
│  │  │  (rusqlite)    │ │   (sqlx)      │ │   (sqlx)     │  │   │
│  │  └────────────────┘ └───────────────┘ └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 模块             | 路径                     | 职责                     |
| -------------- | ---------------------- | ---------------------- |
| **core**       | `packages/core/`       | 应用壳、状态管理、API封装、路由、i18n |
| **components** | `packages/components/` | 通用UI组件库                |
| **connection** | `packages/connection/` | 连接管理UI、数据库类型配置         |
| **editor**     | `packages/editor/`     | SQL编辑器、Monaco集成        |
| **result**     | `packages/result/`     | 结果集展示、虚拟表格             |
| **schema**     | `packages/schema/`     | 数据库对象树状浏览              |
| **desktop**    | `apps/desktop/`        | Tauri桌面应用入口            |

### 2.3 Rust Crates 结构

```
src-tauri/
├── crates/
│   ├── core/           # 连接管理器核心
│   ├── db-common/      # 驱动抽象层 (Trait定义)
│   └── drivers/
│       ├── sqlite-driver/   # SQLite 驱动
│       ├── mysql-driver/    # MySQL 驱动
│       └── postgres-driver/ # PostgreSQL 驱动
├── src/
│   ├── lib.rs          # Tauri命令注册
│   └── main.rs         # 应用入口
```

***

## 3. 前端核心模块

### 3.1 core 模块

#### 3.1.1 状态管理 (Stores)

**connection.ts** - 连接状态管理

```typescript
export interface Connection {
  id: string
  name: string
  host?: string
  port?: number
  user?: string
  database?: string
  driver_type: string  // 'sqlite' | 'mysql' | 'postgres' | 'oracle'
  connection_string?: string
  status: ConnectionStatus  // 'idle' | 'connecting' | 'connected' | 'disconnected'
  folderId?: string
}
```

**核心方法**：

- `addConnection()` - 添加新连接
- `removeConnection(id)` - 删除连接
- `setCurrentConnection(id)` - 设置当前连接
- `updateConnectionStatus(id, status)` - 更新连接状态
- `connectionsByFolder` - 按文件夹分组的连接列表

**文件位置**：[packages/core/src/stores/connection.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/core/src/stores/connection.ts)

**editor.ts** - 编辑器标签页管理

```typescript
export interface Tab {
  id: string
  name: string
  sql: string
}
```

**核心方法**：

- `addTab(tab)` - 添加标签页
- `closeTab(id)` - 关闭标签页
- `setActiveTab(id)` - 设置活动标签页
- `updateTabSql(id, sql)` - 更新标签页SQL内容

**文件位置**：[packages/core/src/stores/editor.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/core/src/stores/editor.ts)

**result.ts** - 查询结果管理

```typescript
export interface ResultSet {
  id: string
  columns: string[]
  rows: unknown[][]
  executionTime?: number
}

export interface LogEntry {
  id: string
  message: string
  level: 'info' | 'warn' | 'error' | 'success'
  timestamp: number
}
```

**核心方法**：

- `setResults(value)` - 设置查询结果
- `setError(message)` - 设置错误信息
- `addLog(entry)` - 添加日志条目
- `setLoading(value)` - 设置加载状态

**文件位置**：[packages/core/src/stores/result.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/core/src/stores/result.ts)

**app.ts** - 应用全局状态

```typescript
export type Theme = 'light' | 'dark' | 'system'
export type Locale = 'zh-CN' | 'en'
```

**核心方法**：

- `setTheme(value)` - 设置主题
- `setLocale(value)` - 设置语言
- `toggleSidebar()` - 切换侧边栏状态
- `initialize()` - 初始化主题

**文件位置**：[packages/core/src/stores/app.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/core/src/stores/app.ts)

#### 3.1.2 API 封装

**api/index.ts** - Tauri命令封装层

```typescript
// 核心接口
export interface ConnectionConfig {
  driver_type: string
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  connection_string?: string
  options?: Record<string, unknown>
}

export interface QueryResult {
  columns: ColumnInfo[]
  rows: unknown[][]
  row_count: number
  execution_time: number
  affected_rows?: number
}

export interface AppError {
  code: string
  message: string
  detail?: string
  suggestion?: string
}
```

**暴露的API方法**：

| 方法                       | 说明       | 参数                       | 返回值                |
| ------------------------ | -------- | ------------------------ | ------------------ |
| `connect(config)`        | 建立数据库连接  | `ConnectionConfig`       | `ConnectionId`     |
| `disconnect(id)`         | 断开连接     | `ConnectionId`           | `void`             |
| `executeSql(id, sql)`    | 执行SQL    | `ConnectionId`, `string` | `QueryResult`      |
| `cancelQuery(id)`        | 取消查询     | `ConnectionId`           | `void`             |
| `getMetadata(id)`        | 获取数据库元数据 | `ConnectionId`           | `DatabaseMetadata` |
| `testConnection(config)` | 测试连接     | `ConnectionConfig`       | `TestResult`       |

**文件位置**：[packages/core/src/api/index.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/core/src/api/index.ts)

#### 3.1.3 路由配置

```typescript
const routes = [
  { path: '/', name: 'MainWorkspace', component: MainWorkspace.vue },
  { path: '/settings', name: 'SettingsPage', component: SettingsPage.vue },
]
```

**文件位置**：[packages/core/src/router/index.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/core/src/router/index.ts)

#### 3.1.4 国际化 (i18n)

支持中英文切换，使用 `vue-i18n` 管理。

**文件位置**：[packages/core/src/i18n/index.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/core/src/i18n/index.ts)

***

### 3.2 components 模块

提供通用 UI 组件库，基于 TailwindCSS 封装：

| 组件             | 说明     | 文件位置                                                                                                                                                       |
| -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LButton`      | 按钮组件   | [LButton.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LButton.vue)           |
| `LInput`       | 输入框组件  | [LInput.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LInput.vue)             |
| `LModal`       | 模态框组件  | [LModal.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LModal.vue)             |
| `LSplitPane`   | 分割面板组件 | [LSplitPane.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LSplitPane.vue)     |
| `LSelect`      | 选择器组件  | [LSelect.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LSelect.vue)           |
| `LContextMenu` | 右键菜单组件 | [LContextMenu.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LContextMenu.vue) |
| `LTooltip`     | 提示组件   | [LTooltip.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LTooltip.vue)         |
| `LIcon`        | 图标组件   | [LIcon.vue](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/components/src/components/LIcon.vue)               |

***

### 3.3 editor 模块

#### 3.3.1 Monaco 编辑器集成

**useMonaco.ts** - Monaco Editor 封装 Hook

```typescript
export interface UseMonacoOptions {
  value?: string
  language?: string
  readOnly?: boolean
}

// 核心方法
function initMonaco(container: HTMLElement, options?: UseMonacoOptions)
function getEditor()
function dispose()
```

**文件位置**：[packages/editor/src/composables/useMonaco.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/editor/src/composables/useMonaco.ts)

**组件**：

- `SqlEditor.vue` - SQL编辑器主组件
- `EditorTabs.vue` - 标签页管理组件

***

### 3.4 connection 模块

#### 3.4.1 数据库类型配置

**database-types.ts** - 数据库驱动配置

```typescript
export interface DriverConfig {
  type: DriverType
  name: string
  defaultPort: number
  defaultUser: string
  connectionNameTemplate: string
  fields: DriverFieldConfig[]
}

export const DRIVER_CONFIGS: Record<DriverType, DriverConfig> = {
  sqlite: { /* ... */ },
  mysql: { /* ... */ },
  postgres: { /* ... */ },
  oracle: { /* ... */ },
}
```

**文件位置**：[packages/connection/src/config/database-types.ts](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/packages/connection/src/config/database-types.ts)

**组件**：

- `ConnectionPanel.vue` - 连接管理面板
- `ConnectionTree.vue` - 连接树组件

***

### 3.5 result 模块

**组件**：

- `ResultPanel.vue` - 结果展示面板
- `LVirtualTable.vue` - 虚拟滚动表格组件
- `HistoryPanel.vue` - 查询历史面板

***

### 3.6 schema 模块

**组件**：

- `SchemaTree.vue` - 数据库对象树状浏览器

***

## 4. 后端 Rust 模块

### 4.1 db-common crate

#### 4.1.1 驱动抽象 Trait

```rust
#[async_trait]
pub trait DbDriver: Send + Sync {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), AppError>;
    async fn disconnect(&mut self) -> Result<(), AppError>;
    async fn execute(&mut self, sql: &str) -> Result<QueryResult, AppError>;
    async fn get_metadata(&self) -> Result<DatabaseMetadata, AppError>;
    async fn cancel_query(&self) -> Result<(), AppError>;
    async fn test_connection(&mut self, config: &ConnectionConfig) -> Result<TestResult, AppError>;
}
```

**文件位置**：[apps/desktop/src-tauri/crates/db-common/src/lib.rs](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/apps/desktop/src-tauri/crates/db-common/src/lib.rs)

#### 4.1.2 核心数据结构

| 结构体                | 说明     |
| ------------------ | ------ |
| `ConnectionConfig` | 连接配置   |
| `ColumnInfo`       | 列信息    |
| `QueryResult`      | 查询结果   |
| `TableInfo`        | 表信息    |
| `ViewInfo`         | 视图信息   |
| `DatabaseMetadata` | 数据库元数据 |
| `AppError`         | 错误类型   |

#### 4.1.3 错误码体系

| 错误码                    | 说明      |
| ---------------------- | ------- |
| `ERR_DB_CONNECTION`    | 数据库连接错误 |
| `ERR_CONN_TIMEOUT`     | 连接超时    |
| `ERR_DB_QUERY`         | 查询执行错误  |
| `ERR_QUERY_CANCELLED`  | 查询被取消   |
| `ERR_DRIVER_NOT_FOUND` | 驱动未找到   |
| `ERR_SSH_TUNNEL`       | SSH隧道错误 |
| `ERR_NOT_FOUND`        | 资源未找到   |

***

### 4.2 core crate

**ConnectionManager** - 连接管理器

```rust
pub struct ConnectionManager {
    connections: DashMap<String, Arc<Mutex<Box<dyn DbDriver>>>>,
}
```

**核心方法**：

- `connect(config)` - 创建并管理新连接
- `disconnect(id)` - 断开指定连接
- `execute(id, sql)` - 执行SQL查询
- `get_metadata(id)` - 获取数据库元数据
- `cancel_query(id)` - 取消正在执行的查询
- `test_connection(config)` - 测试连接配置

**文件位置**：[apps/desktop/src-tauri/crates/core/src/lib.rs](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/apps/desktop/src-tauri/crates/core/src/lib.rs)

***

### 4.3 数据库驱动

#### 4.3.1 SqliteDriver

基于 `rusqlite` 库实现 SQLite 驱动。

**文件位置**：[apps/desktop/src-tauri/crates/drivers/sqlite-driver/src/lib.rs](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/apps/desktop/src-tauri/crates/drivers/sqlite-driver/src/lib.rs)

#### 4.3.2 MySqlDriver

基于 `sqlx` 库实现 MySQL 驱动。支持查询取消（通过 `KILL QUERY`）。

**文件位置**：[apps/desktop/src-tauri/crates/drivers/mysql-driver/src/lib.rs](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/apps/desktop/src-tauri/crates/drivers/mysql-driver/src/lib.rs)

#### 4.3.3 PostgresDriver

基于 `sqlx` 库实现 PostgreSQL 驱动。支持查询取消（通过 `pg_cancel_backend`）。

**文件位置**：[apps/desktop/src-tauri/crates/drivers/postgres-driver/src/lib.rs](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/apps/desktop/src-tauri/crates/drivers/postgres-driver/src/lib.rs)

***

### 4.4 Tauri 命令注册

**lib.rs** - 暴露给前端的命令

```rust
#[tauri::command]
async fn connect(state: State<'_, ConnectionManager>, config: ConnectionConfig) -> Result<String, AppError>

#[tauri::command]
async fn disconnect(state: State<'_, ConnectionManager>, id: String) -> Result<(), AppError>

#[tauri::command]
async fn execute_sql(state: State<'_, ConnectionManager>, id: String, sql: String) -> Result<QueryResult, AppError>

#[tauri::command]
async fn get_metadata(state: State<'_, ConnectionManager>, id: String) -> Result<DatabaseMetadata, AppError>

#[tauri::command]
async fn cancel_query(state: State<'_, ConnectionManager>, id: String) -> Result<(), AppError>

#[tauri::command]
async fn test_connection(state: State<'_, ConnectionManager>, config: ConnectionConfig) -> Result<TestResult, AppError>
```

**文件位置**：[apps/desktop/src-tauri/src/lib.rs](file:///C:/Users/HH/.trae-cn/worktrees/linkbase/feat-generate-code-wiki-doc-NxmTlG/apps/desktop/src-tauri/src/lib.rs)

***

## 5. 项目依赖关系

### 5.1 前端依赖树

```
@linkbase/core
├── pinia              # 状态管理
├── vue-router         # 路由
├── vue-i18n           # 国际化
└── @tauri-apps/api    # Tauri API

@linkbase/components
└── tailwindcss        # CSS框架

@linkbase/editor
├── @monaco-editor/loader  # Monaco编辑器
└── monaco-editor          # Monaco核心

@linkbase/connection
└── @linkbase/core         # 核心模块

@linkbase/result
└── @linkbase/core         # 核心模块

@linkbase/schema
└── @linkbase/core         # 核心模块
```

### 5.2 Rust 依赖树

```
linkbase_core
├── dashmap           # 并发安全Map
├── db_common         # 驱动抽象层
├── mysql_driver      # MySQL驱动
├── postgres_driver   # PostgreSQL驱动
├── sqlite_driver     # SQLite驱动
└── uuid              # UUID生成

db_common
├── async_trait       # 异步Trait
├── serde             # 序列化
└── serde_json        # JSON序列化

mysql_driver
├── sqlx              # MySQL数据库访问
└── db_common         # 驱动抽象层

postgres_driver
├── sqlx              # PostgreSQL数据库访问
└── db_common         # 驱动抽象层

sqlite_driver
├── rusqlite          # SQLite数据库访问
└── db_common         # 驱动抽象层
```

***

## 6. 项目运行方式

### 6.1 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# Tauri 命令
pnpm tauri dev      # 启动Tauri开发模式
pnpm tauri build    # 构建Tauri应用
```

### 6.2 目录结构说明

```
├── apps/
│   └── desktop/           # Tauri桌面应用
│       ├── src/           # Vue前端代码
│       ├── src-tauri/     # Rust后端代码
│       └── package.json   # 桌面应用依赖
├── packages/
│   ├── core/              # 核心模块
│   ├── components/        # UI组件库
│   ├── connection/        # 连接管理
│   ├── editor/            # SQL编辑器
│   ├── result/            # 结果展示
│   └── schema/            # 数据库对象浏览
├── package.json           # 根依赖配置
├── pnpm-workspace.yaml    # Monorepo配置
└── README.md              # 项目说明
```

### 6.3 关键配置文件

| 文件                                  | 说明                |
| ----------------------------------- | ----------------- |
| `apps/desktop/tauri.conf.json`      | Tauri配置（窗口大小、权限等） |
| `apps/desktop/src-tauri/Cargo.toml` | Rust依赖配置          |
| `packages/core/tsconfig.json`       | TypeScript配置      |
| `pnpm-workspace.yaml`               | Monorepo工作区配置     |

***

## 7. 核心工作流程

### 7.1 连接管理流程

```
用户创建连接
    │
    ▼
ConnectionStore.addConnection()
    │
    ▼
API.connect(config)
    │
    ▼ (Tauri IPC)
Rust ConnectionManager.connect()
    │
    ▼
创建对应驱动实例 (Sqlite/MySQL/PostgresDriver)
    │
    ▼
驱动.connect() 建立实际连接
    │
    ▼
返回 ConnectionId
    │
    ▼
ConnectionStore.updateConnectionStatus(id, 'connected')
```

### 7.2 SQL执行流程

```
用户执行SQL
    │
    ▼
EditorStore.updateTabSql()
    │
    ▼
API.executeSql(connectionId, sql)
    │
    ▼ (Tauri IPC)
Rust ConnectionManager.execute()
    │
    ▼
驱动.execute(sql)
    │
    ▼
返回 QueryResult
    │
    ▼
ResultStore.setResults()
    │
    ▼
UI渲染虚拟表格
```

***

## 8. 扩展能力

### 8.1 新增数据库驱动

1. 在 `db-common` 中定义的 `DbDriver` trait 实现驱动
2. 在 `core` 的 `ConnectionManager.connect()` 中添加驱动类型判断
3. 在前端 `database-types.ts` 中添加驱动配置

### 8.2 新增前端模块

遵循 monorepo 模式，在 `packages/` 下创建新目录，配置 `package.json`，并在 `packages/core/src/index.ts` 中导出。

***

## 9. 代码规范

### 9.1 前端规范

- 使用 Vue 3 Composition API + `<script setup>`
- TypeScript 严格模式
- ESLint + Prettier 代码检查
- 组件命名：大驼峰，前缀 `L`（如 `LButton`）
- Store 命名：`useXXXStore`

### 9.2 Rust 规范

- 使用 `clippy` 严格模式
- 异步代码使用 `async_trait`
- 错误处理使用 `Result` 类型
- 驱动实现必须实现 `DbDriver` trait

***

## 10. 参考文档

- [Vue 3 官方文档](https://vuejs.org/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Tauri 文档](https://tauri.app/)
- [sqlx 文档](https://docs.rs/sqlx/)
- [rusqlite 文档](https://docs.rs/rusqlite/)
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/)

