# M1 核心工作闭环 Spec

## Why

M0 阶段已交付可运行的壳（SQLite 连接与基本查询）。M1 阶段将使产品成为真正可日常使用的数据库工具——添加 MySQL/PostgreSQL 原生驱动、Monaco 编辑器集成、虚拟滚动结果表格、查询历史，以及完善连接管理的全功能（测试、分组、导入导出等），实现"核心工作闭环"。

## What Changes

- **新增 MySQL 原生驱动**：基于 `sqlx` 实现 `DbDriver` trait，支持 MySQL 5.7+/8.0
- **新增 PostgreSQL 原生驱动**：基于 `sqlx` 实现 `DbDriver` trait，支持 PostgreSQL 10+
- **连接管理全功能**：连接测试与诊断、文件夹分组、导入/导出配置、保活心跳、前后端状态同步
- **Monaco Editor 集成**：替换现有 textarea，集成语法高亮、SQL 方言智能补全、多标签页编辑器、SQL 格式化
- **虚拟滚动结果表格**：自研基于 `@tanstack/virtual` 的高性能表格，支持百万行流畅滚动、列操作、数据拷贝
- **查询历史系统**：自动记录执行过的 SQL，支持搜索、过滤、回填、收藏
- **多标签页编辑**：利用已定义的 `useEditorStore` Tab 接口实现多标签页切换 UI
- **查询取消**：实现 `CancellableQuery` trait，支持 MySQL/PostgreSQL 的原生查询取消
- **`@linkbase/schema` 包激活**：填充对象浏览器功能（树形导航、右键菜单、表详情面板）
- **`@linkbase/components` 包激活**：填充通用组件库（按钮、输入框、Modal、SplitPane 等）

## Impact

- Affected specs: `setup-foundation-arch`（M0 基础架构）
- Affected code:
  - Rust: `crates/drivers/` (新增 mysql-driver, postgres-driver)、`crates/core/` (扩展 ConnectionManager)、`crates/db-common/` (可能需要扩展 trait)
  - Frontend: `packages/editor/` (Monaco 替换)、`packages/result/` (虚拟表格)、`packages/connection/` (全功能扩展)、`packages/schema/` (激活)、`packages/components/` (激活)、`packages/core/` (stores 扩展、API 扩展、类型扩展)

---

## ADDED Requirements

### Requirement: MySQL 原生驱动

系统 SHALL 提供基于 `sqlx` 的 MySQL 原生驱动，实现 `DbDriver` trait 的全部方法，支持 MySQL 5.7+ 和 8.0。

后端 SHALL 支持以下连接参数：host、port、user、password、database、charset。

驱动 SHALL 自动区分 SELECT 查询（返回 rows）与 DML 语句（返回 affected_rows），通过 `sqlx` 的 `query()` / `execute()` 方法。

驱动 SHALL 实现 `CancellableQuery` trait，通过 `KILL QUERY <connection_id>` 取消正在执行的查询。

#### Scenario: MySQL 连接成功

- **WHEN** 用户提供正确的 MySQL 连接参数并调用 `connect`
- **THEN** 系统建立连接，返回连接 UUID，并可通过该 UUID 执行 SQL 和获取元数据

#### Scenario: MySQL 查询执行

- **WHEN** 用户在 MySQL 连接上执行 `SELECT * FROM users`
- **THEN** 返回包含 columns 和 rows 的 `QueryResult`

#### Scenario: MySQL 查询取消

- **WHEN** 用户对正在执行长查询的 MySQL 连接调用取消
- **THEN** 查询在 2 秒内终止，返回取消错误

#### Scenario: MySQL 元数据获取

- **WHEN** 用户请求 MySQL 数据库的元数据
- **THEN** 返回当前数据库中所有表及其列信息

---

### Requirement: PostgreSQL 原生驱动

系统 SHALL 提供基于 `sqlx` 的 PostgreSQL 原生驱动，实现 `DbDriver` trait 的全部方法，支持 PostgreSQL 10+。

后端 SHALL 支持以下连接参数：host、port、user、password、database、sslmode。

驱动 SHALL 自动区分 SELECT 查询（返回 rows）与 DML 语句（返回 affected_rows）。

驱动 SHALL 实现 `CancellableQuery` trait，通过 `pg_cancel_backend(pid)` 取消正在执行的查询。

#### Scenario: PostgreSQL 连接成功

- **WHEN** 用户提供正确的 PostgreSQL 连接参数并调用 `connect`
- **THEN** 系统建立连接，返回连接 UUID

#### Scenario: PostgreSQL 元数据获取（含 schema 信息）

- **WHEN** 用户请求 PostgreSQL 数据库的元数据
- **THEN** 返回按 schema 分组的表及其列信息

#### Scenario: PostgreSQL 查询取消

- **WHEN** 用户对正在执行长查询的 PostgreSQL 连接调用取消
- **THEN** 查询在 2 秒内终止

---

### Requirement: 连接管理全功能

连接管理模块 SHALL 在 M0 已有功能基础上，增加以下全功能。

**连接测试与诊断**：用户 SHOULD 能够点击"测试连接"按钮，系统展示延迟、服务器版本、SSL 状态、驱动信息。

**文件夹分组**：用户 SHOULD 能够创建/重命名/删除文件夹，将连接拖入文件夹进行分组管理。

**连接保活**：系统 SHALL 支持可配置的心跳间隔，自动检测断开的连接并尝试重连。

**导入/导出配置**：用户 SHOULD 能够将连接配置导出为文件（警告明文风险），并导入已有配置。

**SSH 隧道**：用户 SHOULD 能够配置 SSH 隧道（密码或密钥认证），系统自动建立端口转发后再连接数据库。

**SSL/TLS 配置**：用户 SHOULD 能够配置 SSL 连接参数（证书验证模式、CA 证书路径、客户端证书）。

#### Scenario: 连接测试成功

- **WHEN** 用户填写连接参数后点击"测试连接"
- **THEN** 系统显示连接成功，并展示延迟时间、服务器版本、SSL 状态

#### Scenario: 文件夹分组

- **WHEN** 用户创建文件夹"生产环境"，并将 3 个连接拖入该文件夹
- **THEN** 连接列表按文件夹分组展示

#### Scenario: 连接自动重连

- **WHEN** 已连接的数据连接因网络波动断开
- **THEN** 系统检测到断开后自动尝试重连，状态栏显示"重连中"

---

### Requirement: Monaco Editor 集成

SQL 编辑器 SHALL 由 M0 的 textarea 替换为 Monaco Editor，提供 IDE 级别的编辑体验。

系统 SHALL 根据当前连接的数据库方言提供语法高亮（SQLite / MySQL / PostgreSQL）。

系统 SHALL 提供上下文感知的智能补全，包括：SQL 关键字、当前数据库的表名、当前表的列名、内置函数、用户自定义代码片段。

多标签页编辑器 SHALL 支持：新建/关闭标签页、标签页拖拽排序、标签页重命名、未保存状态标记。

编辑器 SHALL 支持 SQL 格式化功能（美化/压缩），可配置缩进、大小写等风格。

编辑器 SHALL 提供执行选项：执行全部（Ctrl+Enter）、执行选中语句、逐条执行（分号分隔）。

编辑器工具栏 SHALL 提供事务控件：开始事务 / 提交 / 回滚按钮，当前事务状态清晰展示。

#### Scenario: SQL 补全

- **WHEN** 用户连接 MySQL 数据库，输入 `SELECT * FROM ` 后触发补全
- **THEN** 补全列表显示当前数据库所有表名

#### Scenario: 列名补全

- **WHEN** 用户输入 `SELECT ` 后触发补全
- **THEN** 补全列表包含关键字和上下文相关列名

#### Scenario: 多标签页

- **WHEN** 用户点击"新建标签页"按钮
- **THEN** 创建新的空白编辑器标签页，标签栏显示 "Query 1"、"Query 2"等

#### Scenario: 执行选中语句

- **WHEN** 用户在编辑器中选中部分 SQL 文本，点击"执行选中"
- **THEN** 仅执行选中的 SQL 语句

#### Scenario: SQL 格式化

- **WHEN** 用户点击"格式化 SQL"按钮或快捷键
- **THEN** 当前编辑器的 SQL 代码按配置的格式美化

---

### Requirement: 虚拟滚动结果表格

结果展示 SHALL 使用基于 `@tanstack/virtual` 的自研虚拟滚动表格组件，替换 M0 的 Naive UI `NDataTable`。

表格 SHALL 支持：百万行数据流畅滚动（≥30fps）、动态行高、列宽拖拽调整、固定列、隐藏列。

表格 SHALL 支持列排序和列过滤（客户端实现）。

数据拷贝 SHALL 支持多种格式：TSV、CSV、JSON、Markdown、INSERT 语句。用户可通过右键菜单选择格式。

表格 SHALL 支持双击单元格进入编辑模式，修改后高亮变更行。

NULL 值 SHALL 以差异化样式显式显示。

#### Scenario: 10 万行流畅滚动

- **WHEN** 执行返回 10 万行数据的查询
- **THEN** 表格渲染完成，滚动帧率 ≥ 30fps

#### Scenario: 单元格编辑

- **WHEN** 用户双击结果表格中的某个单元格
- **THEN** 该单元格进入编辑模式，用户修改后按 Enter 确认，该行高亮为已修改状态

#### Scenario: 多格式拷贝

- **WHEN** 用户选中一行数据，右键选择"复制为 JSON"
- **THEN** 该行数据以 JSON 格式复制到剪贴板

---

### Requirement: 查询历史系统

系统 SHALL 自动记录用户执行的每条 SQL 语句（通过 `useEditorStore` 或新增 `useHistoryStore`）。

历史面板 SHALL 支持：按时间倒序展示、关键字搜索过滤、按数据库连接过滤。

用户 SHOULD 能够点击历史记录将其回填到当前编辑器。

用户 SHOULD 能够将常用查询"收藏"（固定到历史列表顶部），并可添加备注。

历史数据 SHALL 持久化到本地存储（localStorage 或 IndexedDB）。

#### Scenario: SQL 自动记录

- **WHEN** 用户在 SQLite 连接上执行 `SELECT * FROM users`
- **THEN** 该 SQL 语句自动记录到查询历史，包含执行时间和连接名

#### Scenario: 历史搜索

- **WHEN** 用户在历史面板搜索"users"
- **THEN** 历史列表过滤为包含 "users" 关键字的 SQL 语句

#### Scenario: 历史回填

- **WHEN** 用户在历史列表中点击某条记录
- **THEN** 该 SQL 语句回填到当前活动编辑器标签页，替换或追加内容

---

### Requirement: 数据库对象浏览器（Schema 包）

`@linkbase/schema` 包 SHALL 被激活，提供完整的数据库对象导航功能。

系统 SHALL 以树状结构展示：连接 → 数据库/目录 → 模式（Schema）→ 表、视图。

对象树 SHALL 支持：展开/折叠、模糊搜索表名/列名、右键上下文菜单。

右键菜单 SHALL 包含：生成 SELECT 语句、复制表名、复制 DDL、删除表（需确认）。

表详情面板 SHALL 展示：列信息（名称、类型、可空、默认值、注释）、索引、约束、DDL 预览。

双击表名 SHALL 自动生成 `SELECT * FROM <table> LIMIT 100` 并在编辑器中执行。

#### Scenario: 树形导航

- **WHEN** 用户连接 PostgreSQL 数据库并展开连接节点
- **THEN** 显示 Schema 列表，展开 Schema 后显示 Tables、Views 等分类

#### Scenario: 搜索表名

- **WHEN** 用户在对象树搜索框输入 "user"
- **THEN** 树过滤为名称包含 "user" 的表，并在匹配列名时展开对应表

#### Scenario: 表详情

- **WHEN** 用户右键点击表名选择"查看详情"
- **THEN** 展示列信息、索引、约束、DDL 预览面板

---

### Requirement: 通用组件库（Components 包）

`@linkbase/components` 包 SHALL 被激活，提供项目级通用 UI 组件。

组件 SHALL 包括：
- `LButton`：按钮（primary/secondary/danger/ghost 变体，loading 状态）
- `LInput`：输入框（支持 prefix/suffix icon、clearable、密码模式）
- `LModal`：模态框（标题、内容、确认/取消按钮、自定义 footer）
- `LSplitPane`：可拖拽分割面板（替代 MainLayout 中内联的分割逻辑）
- `LSelect`：下拉选择框（搜索、多选）
- `LContextMenu`：右键上下文菜单
- `LTooltip`：悬停提示
- `LIcon`：图标组件

所有组件 SHALL 支持亮色/暗色主题自适应。

#### Scenario: 组件主题适应

- **WHEN** 用户切换亮色/暗色主题
- **THEN** 所有 LButton/LInput/LModal 等组件自动跟随主题变化

---

## MODIFIED Requirements

### Requirement: ConnectionManager 多驱动支持

M0 的 `ConnectionManager` SHALL 扩展为支持多种数据库驱动类型。

`ConnectionConfig` 结构体 SHALL 新增字段以支持 MySQL/PostgreSQL 的连接参数。

Tauri 命令层 SHALL 新增命令：`cancel_query(connection_id: String) -> Result<(), AppError>`、`test_connection(config: ConnectionConfig) -> Result<TestResult, AppError>`。

#### Scenario: 动态驱动选择

- **WHEN** 用户创建 MySQL 类型的连接配置
- **THEN** `ConnectionManager` 自动实例化 MySQL 驱动并建立连接

---

### Requirement: AppError 扩展

`AppError` SHALL 新增错误码常量以覆盖 M1 新增功能：
- `ERR_CONN_TIMEOUT`：连接超时
- `ERR_QUERY_CANCELLED`：查询被用户取消
- `ERR_DRIVER_NOT_FOUND`：不支持的驱动类型
- `ERR_SSH_TUNNEL`：SSH 隧道错误

---

### Requirement: 前端 Store 扩展

`useConnectionStore` SHALL 扩展以支持：文件夹分组、连接状态（idle/connecting/connected/disconnected/reconnecting/error）、测试连接、导入导出。

`useEditorStore` SHALL 扩展以支持：多标签页的实际 UI 交互、标签页脏状态标记、自动补全上下文。

新增 `useHistoryStore` SHALL 管理：查询历史列表、搜索/过滤、收藏/取消收藏、持久化。

---

### Requirement: 前端 API 层扩展

`@linkbase/core/api` SHALL 新增方法：`cancelQuery(connectionId: string)`、`testConnection(config: ConnectionConfig)`。

TypeScript 类型定义 SHALL 与 Rust 后端新增结构体保持同步。

---

## REMOVED Requirements

### Requirement: Naive UI NDataTable 结果展示

**Reason**：虚拟滚动和性能需求，替换为自研 `@tanstack/virtual` 表格组件。

**Migration**：删除 `ResultPanel.vue` 中对 Naive UI `NDataTable` 的引用，替换为自研 `LVirtualTable` 组件。

### Requirement: 原生 textarea SQL 编辑器

**Reason**：功能需求，替换为 Monaco Editor。

**Migration**：删除 `SqlEditor.vue` 中的 `<textarea>` 实现，替换为 Monaco Editor 实例。
