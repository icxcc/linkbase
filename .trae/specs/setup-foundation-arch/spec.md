# 基础架构完善 Spec

## Why
当前项目仅为 Tauri + Vue 的默认脚手架，缺少 PRD 要求的 monorepo 结构、核心布局、路由、主题、i18n、Rust 驱动抽象与 SQLite 驱动实现。需要按 M0 里程碑要求完善基础架构，使其成为可运行的壳，支持 SQLite 基本连接与查询。

## What Changes
- 前端调整为 pnpm monorepo 结构（`apps/desktop` + `packages/*`），替代当前单包结构
- 引入 Vue Router 4、Pinia、vue-i18n、Naive UI，建立应用壳与核心布局
- 建立主题系统（亮色/暗色）与 Tailwind CSS 变量体系
- 建立 i18n 框架，首次发布支持简体中文、英文
- Rust 后端拆分 crate：`core`、`db-common`、`drivers/sqlite-driver`
- 实现驱动抽象 trait（`DbDriver`, `QueryResult`, `Metadata`, `CancellableQuery`）
- 实现 SQLite 原生驱动，支持基本连接与查询
- 前端通过 Tauri invoke 封装层与后端通信，不直接调用

## Impact
- 影响范围：整个项目目录结构、构建配置、前后端代码组织
- 关键文件：
  - `package.json` → `pnpm-workspace.yaml` + 多包结构
  - `src-tauri/Cargo.toml` → workspace 多 crate 结构
  - 新增 `apps/desktop/src` 应用壳、路由、布局、主题、i18n
  - 新增 `src-tauri/crates/{core,db-common,drivers/sqlite-driver}`

## ADDED Requirements

### Requirement: Monorepo 结构
The system SHALL 使用 pnpm workspace 组织前端代码，结构如下：
```
├── apps/desktop/          # Tauri 桌面应用入口
├── packages/components/   # 通用 Vue 组件库
├── packages/core/         # 应用壳、主题、路由、i18n、工具函数
├── packages/connection/   # 连接管理 UI 与逻辑
├── packages/editor/       # SQL 编辑器封装
├── packages/result/       # 结果集展示
└── packages/schema/       # 对象浏览器
```

#### Scenario: 构建成功
- **WHEN** 用户在根目录执行 `pnpm install`
- **THEN** 所有 workspace 包正确链接，依赖安装成功
- **WHEN** 用户执行 `pnpm dev`
- **THEN** Tauri 应用正常启动，显示主界面

### Requirement: 前端应用壳与核心布局
The system SHALL 提供符合 PRD 7.1 节的主布局：
- 顶部标题栏（自定义或系统集成）
- 左侧连接与数据库对象浏览器面板
- 右侧主区域：上部多标签页 SQL 编辑器，下部可拖拽结果面板
- 底部状态栏

#### Scenario: 布局渲染
- **WHEN** 应用启动
- **THEN** 主布局正确渲染，各面板可调整大小
- **WHEN** 切换主题
- **THEN** 整体 UI 颜色方案同步切换

### Requirement: 路由系统
The system SHALL 使用 Vue Router 4 管理前端路由：
- `/`：主工作区（编辑器 + 结果面板）
- `/settings`：设置页面
- 支持路由守卫与懒加载

### Requirement: 状态管理
The system SHALL 使用 Pinia 按功能域拆分 store：
- `useAppStore`：主题、语言、布局状态
- `useConnectionStore`：连接列表、当前连接
- `useEditorStore`：编辑器标签页、当前 SQL
- `useResultStore`：查询结果、消息日志

### Requirement: 主题系统
The system SHALL 支持亮色/暗色主题切换：
- 使用 CSS 变量定义颜色体系
- Tailwind CSS 配置与主题变量联动
- 主题状态持久化到 localStorage
- 支持系统主题自动跟随

### Requirement: 国际化 (i18n)
The system SHALL 使用 vue-i18n 管理所有可见文本：
- 首次发布支持 `zh-CN` 和 `en`
- 语言文件按功能域拆分
- 语言切换即时生效，状态持久化

### Requirement: Rust Crate 拆分
The system SHALL 将 Rust 后端拆分为独立 crate：
```
src-tauri/
├── crates/
│   ├── core/              # 连接池、会话管理、配置读写、查询调度
│   ├── db-common/         # 驱动抽象 trait 定义
│   └── drivers/
│       └── sqlite-driver/ # SQLite 原生驱动
```

### Requirement: 驱动抽象层 (db-common)
The system SHALL 在 `db-common` 中定义以下 trait：
- `DbDriver`：连接、断开、执行查询、获取元数据
- `QueryResult`：结果集迭代、列信息、行数据
- `Metadata`：数据库、表、列、索引等元数据获取
- `CancellableQuery`：查询取消支持

### Requirement: SQLite 驱动实现
The system SHALL 在 `drivers/sqlite-driver` 中实现：
- 基于 `rusqlite` 的 `DbDriver` 实现
- 支持基本连接（文件路径、内存数据库）
- 支持执行 SQL 查询并返回结果集
- 支持获取表列表、列信息等元数据

### Requirement: Tauri 命令封装
The system SHALL 通过 Tauri commands 暴露后端功能：
- `connect(config: ConnectionConfig) -> Result<ConnectionId, AppError>`
- `disconnect(connection_id: ConnectionId) -> Result<(), AppError>`
- `execute_sql(connection_id: ConnectionId, sql: String) -> Result<QueryResult, AppError>`
- `get_metadata(connection_id: ConnectionId) -> Result<DatabaseMetadata, AppError>`
- 前端通过 `@app/core` 中的封装函数调用，不直接使用 `invoke`

### Requirement: 错误响应格式
The system SHALL 使用统一的错误响应格式：
```json
{
  "error": {
    "code": "ERR_DB_CONNECTION_TIMEOUT",
    "message": "无法连接到数据库：连接超时",
    "detail": "...",
    "suggestion": "请检查主机地址和端口，或网络连接"
  }
}
```

## MODIFIED Requirements
无

## REMOVED Requirements
无
