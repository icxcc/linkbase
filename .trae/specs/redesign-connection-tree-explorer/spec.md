# 连接树与对象浏览器重构 Spec

## Why

当前 M1 的侧边栏为上下分离式布局：连接面板（ConnectionPanel）在上、对象浏览器（SchemaTree）在下。两者功能割裂，交互不统一，无法拖拽排序，且对象浏览器对不同数据库类型的元数据展示过于简单（仅有表/列，无视图、函数、存储过程等）。创建连接弹窗也缺乏数据库类型的视觉引导和默认值。需要重构为统一树形交互，提升用户体验和专业度。

## What Changes

* **合并 ConnectionPanel 与 SchemaTree 为统一的** **`ConnectionTree`** **组件**：以单棵树的树形结构同时管理连接和数据库对象，消除上下分离的割裂感

* **多级分组与拖拽排序**：支持连接文件夹（分组）的创建/重命名/删除，支持拖拽连接和分组调整顺序和层级

* **按数据库类型细化元数据结构**：后端 `DatabaseMetadata` 扩展，根据 `driver_type` 返回不同层级的对象（MySQL：数据库→表/视图/函数/存储过程；PostgreSQL：模式→表/视图/物化视图/函数/序列/索引；SQLite：仅表/视图）

* **重新设计创建连接弹窗**：左侧为数据库类型图标列表，右侧为动态表单，根据所选数据库类型显示不同字段和默认值（连接名称默认 `@localhost`）

* **连接配置不强制指定数据库**：数据库字段改为可选，允许管理用户下所有数据库/模式

* **代码规范**：遵循 Vue 3 Composition API + TypeScript + Pinia，Rust 后端遵循已有分层架构

## Impact

* Affected specs: `implement-m1-core-workflow`（M1 的对象浏览器和连接管理）

* **BREAKING**: 移除 `ConnectionPanel.vue` 和 `SchemaTree.vue`，合并为 `ConnectionTree.vue`

* **BREAKING**: 后端 `DatabaseMetadata` 结构体重构，前端 `Metadata` 类型变更

* **BREAKING**: `ConnectionConfig` 结构体变更：新增分离的 host/port/user/password 字段替代单一 `connection_string`

* Affected code:

  * Rust: `db-common/src/lib.rs`（扩展 Metadata）、`core/src/lib.rs`（扩展 ConnectionConfig）、三个驱动（扩展 get\_metadata 实现）、`src/lib.rs`（更新 Tauri 命令）

  * Frontend: `packages/connection/`（重构为 ConnectionTree）、`packages/schema/`（移除或合并到 connection 包）、`packages/core/`（更新 stores、API、types）、`apps/desktop/`（更新 MainLayout）

***

## ADDED Requirements

### Requirement: 统一连接树组件（ConnectionTree）

系统 SHALL 提供 `ConnectionTree.vue` 组件，替代旧的 `ConnectionPanel.vue` + `SchemaTree.vue`，以**单棵树**的方式统一管理连接节点和数据库对象节点。

树的节点层级 SHALL 为：

```
[文件夹/分组]
  └── [连接]（显示连接名称、数据库类型图标、在线/离线状态）
        └── [数据库 / 模式 / 用户等根级容器]（根据数据库类型不同）
              └── [表] ── [表1 ── [列1, 列2, ...], 表2, 表3, ...]
              └── [视图] ── [视图1 ── [列1, 列2, ...], 视图2, ...]
              └── [物化视图]（PostgreSQL）── [物化视图1, 物化视图2, ...]
              └── [函数 / 存储过程] ── [函数1, 函数2, ...]
              └── [序列]（PostgreSQL）── [序列1, 序列2, ...]
              └── [索引]（PostgreSQL）── [索引1, 索引2, ...]
              └── [用户]（MySQL）── [用户1, 用户2, ...]
              └── [角色]（PostgreSQL）── [角色1, 角色2, ...]
              └── [表空间]（Oracle）── [表空间1, 表空间2, ...]
```

**不同数据库类型的节点结构**：

| 数据库类型      | 连接下级根容器    | 根容器下级对象类别                                                                                               |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| SQLite     | 无（直接挂表/视图） | Tables, Views                                                                                           |
| MySQL      | Databases  | Tables, Views, Functions, Stored Procedures, Users                                                      |
| PostgreSQL | Schemas    | Tables, Views, Materialized Views, Functions, Sequences, Indexes, Users, Roles                          |
| Oracle     | Schemas    | Tables, Views, Materialized Views, Functions, Procedures, Sequences, Indexes, Users, Roles, Tablespaces |

#### Scenario: 展开连接查看对象

* **WHEN** 用户点击已连接 MySQL 的连接节点展开箭头

* **THEN** 系统加载该连接下用户有权限的所有数据库，并以 "Databases" 根容器展示，展开数据库后显示 Tables/Views/Functions 等分类

#### Scenario: 单树同时管理连接和对象

* **WHEN** 用户侧边栏只有一个 `ConnectionTree` 组件

* **THEN** 顶部为连接节点（按分组折叠），连接节点的子节点为该连接的对象树；断开连接的节点可以折叠隐藏对象树

#### Scenario: 拖拽连接排序

* **WHEN** 用户拖拽一个连接节点到另一个分组或调整顺序

* **THEN** 系统持久化新的顺序和分组关系（保存到 localStorage）

#### Scenario: 拖拽分组排序

* **WHEN** 用户拖拽一个分组节点调整其在连接树中的位置

* **THEN** 分组顺序被持久化

***

### Requirement: 按数据库类型细化的元数据

后端 `DatabaseMetadata` SHALL 扩展，以结构化的方式返回不同数据库类型的完整对象信息。

`DatabaseMetadata` 新结构 SHALL 包含：

```rust
pub struct DatabaseMetadata {
    pub driver_type: String,
    pub databases: Vec<DatabaseInfo>,    // MySQL: 数据库列表
    pub schemas: Vec<SchemaInfo>,        // PostgreSQL/Oracle: 模式列表
    pub tables: Vec<TableInfo>,          // 传统表列表（SQLite 兼容）
}

pub struct DatabaseInfo {
    pub name: String,
    pub tables: Vec<TableInfo>,
    pub views: Vec<ViewInfo>,
    pub functions: Vec<RoutineInfo>,
    pub procedures: Vec<RoutineInfo>,
    pub users: Vec<UserInfo>,           // MySQL: 用户列表
}

pub struct SchemaInfo {
    pub name: String,
    pub tables: Vec<TableInfo>,
    pub views: Vec<ViewInfo>,
    pub materialized_views: Vec<ViewInfo>,  // PostgreSQL/Oracle
    pub functions: Vec<RoutineInfo>,
    pub procedures: Vec<RoutineInfo>,
    pub sequences: Vec<SequenceInfo>,       // PostgreSQL/Oracle
    pub indexes: Vec<IndexInfo>,            // PostgreSQL
}

pub struct TableInfo {
    pub name: String,
    pub schema: Option<String>,
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
    pub constraints: Vec<ConstraintInfo>,
}

pub struct ViewInfo { pub name: String; pub schema: Option<String>; pub definition: Option<String>; }
pub struct RoutineInfo { pub name: String; pub routine_type: String; pub return_type: Option<String>; }
pub struct SequenceInfo { pub name: String; }
pub struct IndexInfo { pub name: String; pub columns: Vec<String>; pub unique: bool; pub primary: bool; }
pub struct ConstraintInfo { pub name: String; pub constraint_type: String; pub columns: Vec<String>; }
pub struct UserInfo { pub name: String; pub host: Option<String>; }
```

#### Scenario: MySQL 元数据

* **WHEN** 用户请求已连接 MySQL 连接的元数据

* **THEN** 返回 `DatabaseMetadata`，其中 `databases` 包含用户有权限的所有数据库，每个数据库下含 tables/views/functions/procedures

#### Scenario: PostgreSQL 元数据

* **WHEN** 用户请求已连接 PostgreSQL 连接的元数据

* **THEN** 返回 `DatabaseMetadata`，其中 `schemas` 包含用户有权限的所有模式（排除 `pg_catalog` 和 `information_schema`），每个模式下含 tables/views/materialized\_views/functions/sequences

#### Scenario: SQLite 元数据

* **WHEN** 用户请求已连接 SQLite 连接的元数据

* **THEN** 返回 `DatabaseMetadata`，其中 `tables` 包含所有表和视图，无 databases/schemas

***

### Requirement: 创建连接弹窗重构

创建连接弹窗 SHALL 重新设计为左右两栏布局：

* **左侧**：数据库类型图标列表（SQLite、MySQL、PostgreSQL、Oracle），当前选中高亮

* **右侧**：根据所选数据库类型动态渲染的连接表单

连接名称默认值 SHALL 为 `用户名@localhost`（若未输入用户名则为 `@localhost`）。

数据库字段 SHALL 改为**可选**，不填写时表示管理该用户下所有数据库/模式。

**各数据库类型表单字段与默认值**：

| 数据库类型          | 字段        | 默认值                  | 必填        |
| -------------- | --------- | -------------------- | --------- |
| **SQLite**     | 连接名称      | `@localhost`         | 是         |
| <br />         | 模式（内存/文件） | 文件                   | 是         |
| <br />         | 文件路径      | —                    | 文件模式必填    |
| **MySQL**      | 连接名称      | `root@localhost`     | 是         |
| <br />         | 主机        | localhost            | 是         |
| <br />         | 端口        | 3306                 | 是         |
| <br />         | 用户名       | root                 | 否         |
| <br />         | 密码        | —                    | 否         |
| <br />         | 数据库       | —                    | **否（可选）** |
| <br />         | 字符集       | utf8mb4              | 否         |
| **PostgreSQL** | 连接名称      | `postgres@localhost` | 是         |
| <br />         | 主机        | localhost            | 是         |
| <br />         | 端口        | 5432                 | 是         |
| <br />         | 用户名       | postgres             | 否         |
| <br />         | 密码        | —                    | 否         |
| <br />         | 数据库       | —                    | **否（可选）** |
| <br />         | SSL 模式    | prefer               | 否         |
| **Oracle**     | 连接名称      | `system@localhost`   | 是         |
| <br />         | 主机        | localhost            | 是         |
| <br />         | 端口        | 1521                 | 是         |
| <br />         | 用户名       | system               | 否         |
| <br />         | 密码        | —                    | 否         |
| <br />         | 服务名/SID   | —                    | 否         |

#### Scenario: 选择数据库类型自动切换表单

* **WHEN** 用户在左侧列表点击 "MySQL"

* **THEN** 右侧表单切换为 MySQL 连接配置，主机默认 "localhost"、端口默认 3306、连接名称自动更新为 `root@localhost`

#### Scenario: 不指定数据库连接

* **WHEN** 用户创建 MySQL 连接时，数据库字段留空

* **THEN** 连接成功后，ConnectionTree 展示用户有权限的所有数据库

***

### Requirement: ConnectionConfig 结构体重构

`ConnectionConfig` SHALL 从当前的单一 `connection_string` 模式重构为结构化字段，同时保留向后兼容。

```rust
pub struct ConnectionConfig {
    pub driver_type: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub user: Option<String>,
    pub password: Option<String>,
    pub database: Option<String>,      // 可选，不指定则管理所有数据库
    pub connection_string: Option<String>, // 保留兼容，SQLite 使用
    pub options: serde_json::Value,    // 扩展选项（charset, sslmode, service_name 等）
}
```

#### Scenario: 结构化连接配置

* **WHEN** 用户创建 MySQL 连接 `host=192.168.1.1, port=3306, user=admin, password=***`

* **THEN** 生成的 `ConnectionConfig` 中各字段分别填充，驱动内部自行拼接连接字符串

***

### Requirement: 代码与设计规范

前端代码 SHALL 严格遵循：

* Vue 3 Composition API（`<script setup>`）+ TypeScript 类型安全

* Pinia store 管理全局状态

* 使用 `@linkbase/components` 的通用组件（`LButton`, `LInput`, `LSelect`, `LModal`, `LContextMenu` 等）

* CSS 变量实现主题自适应（亮色/暗色）

* 所有用户可见文本通过 `vue-i18n` 的 `$t()` 渲染

Rust 代码 SHALL 严格遵循：

* 驱动抽象通过 `DbDriver` trait 统一接口

* 错误处理使用统一的 `AppError` 格式

* `DatabaseMetadata` 新增结构体实现 `Serialize`/`Deserialize`

* 新增 `get_enhanced_metadata` Tauri 命令（替代旧 `get_metadata`）

***

## MODIFIED Requirements

### Requirement: ConnectionManager 多驱动支持（修改自 M1）

`ConnectionManager::connect` SHALL 接受重构后的 `ConnectionConfig`，驱动内部自行根据结构化字段构建连接。

`ConnectionManager` SHALL 新增方法：

* `get_enhanced_metadata(connection_id: String) -> Result<DatabaseMetadata, AppError>`：返回按数据库类型细化的完整元数据

### Requirement: 前端 Store 扩展（修改自 M1）

`useConnectionStore` SHALL 扩展：

* `connections` 的 `Connection` 接口新增 `host`、`port`、`user`、`database` 分离字段

* 新增 `connectionOrder: string[]` 状态，持久化连接和分组的拖拽排序结果

* 新增 `moveConnection(targetId, targetFolderId, index)` 和 `moveFolder(targetId, index)` 方法

## REMOVED Requirements

### Requirement: ConnectionPanel 组件

**Reason**：合并入 `ConnectionTree.vue`，统一交互模型。
**Migration**：删除 `packages/connection/src/components/ConnectionPanel.vue`，功能迁移到 `ConnectionTree.vue`。

### Requirement: SchemaTree 组件

**Reason**：合并入 `ConnectionTree.vue`，统一树形导航。
**Migration**：删除 `packages/schema/src/components/SchemaTree.vue`，功能迁移到 `ConnectionTree.vue`。

### Requirement: 旧的 `get_metadata` 命令和 `Metadata` 类型

**Reason**：`DatabaseMetadata` 结构体重构，旧接口不再适用。
**Migration**：后端新增 `get_enhanced_metadata` 命令，前端删除旧的 `Metadata` 类型定义，使用新的 `DatabaseMetadata` 类型。
