# Tasks

## 阶段一：Rust 后端 — 元数据结构重构

- [ ] **Task 1: 重构 `DatabaseMetadata` 及关联结构体**
  - [ ] SubTask 1.1: 在 `db-common/src/lib.rs` 中定义新的 `DatabaseMetadata`、`DatabaseInfo`、`SchemaInfo`、`ViewInfo`、`RoutineInfo`、`SequenceInfo`、`IndexInfo`、`ConstraintInfo`、`UserInfo` 结构体，全部派生 `Serialize`/`Deserialize`/`Clone`/`Debug`
  - [ ] SubTask 1.2: 扩展 `TableInfo`，新增 `schema`、`indexes`、`constraints` 字段
  - [ ] SubTask 1.3: 扩展 `ColumnInfo`，新增 `nullable`、`default_value`、`is_primary_key` 字段
  - [ ] SubTask 1.4: 调整 `DbDriver` trait 中 `get_metadata` 的返回类型签名为 `async fn get_metadata(&self) -> Result<DatabaseMetadata, AppError>`
  - [ ] SubTask 1.5: 运行 `cargo check` 确保 db-common 编译通过

- [ ] **Task 2: 重构 `ConnectionConfig` 结构体**
  - [ ] SubTask 2.1: 在 `db-common/src/lib.rs` 中将 `ConnectionConfig` 改为结构化字段（host/port/user/password/database 分离，connection_string 改为 Option）
  - [ ] SubTask 2.2: 保留 `options: serde_json::Value` 字段（用于 charset、sslmode 等扩展参数）
  - [ ] SubTask 2.3: 运行 `cargo check` 确保编译通过

- [ ] **Task 3: 扩展 MySQL 驱动 `get_metadata`**
  - [ ] SubTask 3.1: 查询 `information_schema.SCHEMATA` 获取所有数据库列表
  - [ ] SubTask 3.2: 对每个数据库，分别查询 tables（含 TABLE_TYPE 区分 BASE TABLE/VIEW）、columns、views、routines（FUNCTION/PROCEDURE）
  - [ ] SubTask 3.3: 查询用户列表（`SELECT user, host FROM mysql.user`，无权限则跳过）
  - [ ] SubTask 3.4: 组装为 `DatabaseMetadata { databases: Vec<DatabaseInfo>, .. }` 返回
  - [ ] SubTask 3.5: 更新 MySQL 驱动的 `connect` 方法，适配新的结构化 `ConnectionConfig`（从 field 拼接连接字符串）
  - [ ] SubTask 3.6: 运行 `cargo test -p mysql-driver` 验证

- [ ] **Task 4: 扩展 PostgreSQL 驱动 `get_metadata`**
  - [ ] SubTask 4.1: 查询 `information_schema.schemata` 获取所有模式（排除 `pg_catalog`、`information_schema`）
  - [ ] SubTask 4.2: 对每个模式，查询 tables/views/materialized_views（`pg_matviews`）/routines/sequences（`information_schema.sequences`）
  - [ ] SubTask 4.3: 查询索引（`pg_indexes`）和约束（`information_schema.table_constraints`）
  - [ ] SubTask 4.4: 查询用户/角色（`pg_roles`）
  - [ ] SubTask 4.5: 组装为 `DatabaseMetadata { schemas: Vec<SchemaInfo>, .. }` 返回
  - [ ] SubTask 4.6: 更新 PostgreSQL 驱动的 `connect` 方法，适配新的结构化 `ConnectionConfig`
  - [ ] SubTask 4.7: 运行 `cargo test -p postgres-driver` 验证

- [ ] **Task 5: 扩展 SQLite 驱动 `get_metadata`**
  - [ ] SubTask 5.1: 从 `sqlite_master` 查询 `type='table'` 和 `type='view'` 分别处理
  - [ ] SubTask 5.2: 扩展 `PRAGMA table_info` 获取 `notnull`、`dflt_value`、`pk` 字段
  - [ ] SubTask 5.3: 查询索引信息（`PRAGMA index_list` 和 `PRAGMA index_info`）
  - [ ] SubTask 5.4: 组装为 `DatabaseMetadata { tables: Vec<TableInfo>, .. }` 返回
  - [ ] SubTask 5.5: 运行 `cargo test -p sqlite-driver` 验证

- [ ] **Task 6: 更新 ConnectionManager 与 Tauri 命令层**
  - [ ] SubTask 6.1: 在 `core/src/lib.rs` 中更新 `connect` 方法，适配新的结构化 `ConnectionConfig`
  - [ ] SubTask 6.2: 在 `core/src/lib.rs` 中新增 `get_enhanced_metadata` 方法
  - [ ] SubTask 6.3: 在 `src/lib.rs` 中新增 `get_enhanced_metadata` Tauri 命令，保留旧 `get_metadata` 作为兼容
  - [ ] SubTask 6.4: 运行 `cargo build` 确保全仓编译通过

## 阶段二：前端 — 类型与 Store 更新

- [ ] **Task 7: 更新前端 TypeScript 类型定义**
  - [ ] SubTask 7.1: 在 `packages/core/src/api/index.ts` 中定义新的 `DatabaseMetadata`、`DatabaseInfo`、`SchemaInfo`、`TableInfo`、`ViewInfo`、`RoutineInfo`、`SequenceInfo`、`IndexInfo`、`ConstraintInfo`、`UserInfo` 接口
  - [ ] SubTask 7.2: 更新 `ConnectionConfig` 接口，匹配 Rust 端结构化字段
  - [ ] SubTask 7.3: 新增 `getEnhancedMetadata(connectionId: string): Promise<DatabaseMetadata>` API 函数
  - [ ] SubTask 7.4: 定义 `DriverType` 枚举类型：`'sqlite' | 'mysql' | 'postgres' | 'oracle'`
  - [ ] SubTask 7.5: 在 `packages/core/src/stores/connection.ts` 中更新 `Connection` 接口，新增分离字段（host/port/user/database）
  - [ ] SubTask 7.6: 新增 `connectionOrder`、`folderOrder` 状态及 `moveConnection`、`moveFolder` 方法

- [ ] **Task 8: 创建数据库类型配置定义**
  - [ ] SubTask 8.1: 在 `packages/connection/src/config/database-types.ts` 定义每种数据库类型的配置：名称、图标、默认端口、默认用户名、默认连接名称模板、表单字段列表及其默认值
  - [ ] SubTask 8.2: 定义每种数据库类型的节点结构模板（根容器类型、子对象类别列表），供 ConnectionTree 构建树结构使用

## 阶段三：前端 — ConnectionTree 组件

- [ ] **Task 9: 创建 `ConnectionTree.vue` 核心组件**
  - [ ] SubTask 9.1: 在 `packages/connection/src/components/ConnectionTree.vue` 创建组件骨架：使用 Naive UI 的 `NTree` 组件渲染树结构
  - [ ] SubTask 9.2: 实现 `buildTree()` 函数：将 store 中的连接列表 + 分组 → 转换为 `NTree` 所需的 `TreeOption[]` 格式
  - [ ] SubTask 9.3: 实现连接节点渲染：显示数据库类型图标、连接名称、在线/离线状态指示器
  - [ ] SubTask 9.4: 实现分组节点渲染：文件夹图标、分组名称、展开/折叠状态
  - [ ] SubTask 9.5: 实现 `loadConnectionChildren()` 函数：展开连接节点时懒加载元数据（调用 `getEnhancedMetadata`），根据数据库类型构建对象子节点
  - [ ] SubTask 9.6: 实现对象节点渲染：表/视图/函数/存储过程等按类别分组展示，不同图标区分

- [ ] **Task 10: 实现 ConnectionTree 右键菜单**
  - [ ] SubTask 10.1: 右键分组节点：新建连接（在此分组）、重命名分组、删除分组
  - [ ] SubTask 10.2: 右键连接节点：连接/断开、编辑连接、测试连接、删除连接、移到分组
  - [ ] SubTask 10.3: 右键表节点：生成 SELECT、复制表名、复制 DDL、查看详情
  - [ ] SubTask 10.4: 右键视图节点：生成 SELECT、复制 DDL
  - [ ] SubTask 10.5: 右键函数/存储过程节点：生成调用语句、复制名称
  - [ ] SubTask 10.6: 面板空白处右键：新建连接、新建分组

- [ ] **Task 11: 实现拖拽排序功能**
  - [ ] SubTask 11.1: 连接节点支持拖拽到不同分组或调整在分组内的顺序
  - [ ] SubTask 11.2: 分组节点支持拖拽调整在树中的顺序
  - [ ] SubTask 11.3: 拖拽完成后调用 `moveConnection` / `moveFolder` 更新 store 并持久化顺序
  - [ ] SubTask 11.4: 拖拽时视觉反馈：目标位置高亮指示

- [ ] **Task 12: 实现对象节点交互**
  - [ ] SubTask 12.1: 双击表名自动生成 `SELECT * FROM <table> LIMIT 100` 并执行
  - [ ] SubTask 12.2: 双击视图名自动生成 `SELECT * FROM <view> LIMIT 100` 并执行
  - [ ] SubTask 12.3: 双击函数/存储过程名在编辑器中打开其定义
  - [ ] SubTask 12.4: 展开表节点时懒加载列信息（如果 `TableInfo.columns` 有数据则直接渲染，否则调用单独接口）
  - [ ] SubTask 12.5: 搜索框：支持模糊搜索连接名、表名、列名，过滤树节点

- [ ] **Task 13: 更新 MainLayout 集成 ConnectionTree**
  - [ ] SubTask 13.1: 在 `MainLayout.vue` 的侧边栏中，移除旧的 `ConnectionPanel` 和 `SchemaTree` 引用
  - [ ] SubTask 13.2: 引入 `ConnectionTree` 组件，占满整个侧边栏（移除 40% 的高度限制）
  - [ ] SubTask 13.3: 将原来 `MainLayout` 中的 `handleExecute` 等回调适配 `ConnectionTree` 的事件

## 阶段四：前端 — 创建连接弹窗重构

- [ ] **Task 14: 创建 `ConnectionDialog.vue` 左列表右表单布局**
  - [ ] SubTask 14.1: 创建 `packages/connection/src/components/ConnectionDialog.vue`，使用 `LModal` 作为容器
  - [ ] SubTask 14.2: 左侧：数据库类型图标列表（SQLite/MySQL/PostgreSQL/Oracle），使用 `LIcon`，当前选中高亮
  - [ ] SubTask 14.3: 右侧：根据 `selectedDriverType` 动态渲染对应表单
  - [ ] SubTask 14.4: 连接名称默认值：监听用户名变化自动更新为 `{用户名}@localhost`
  - [ ] SubTask 14.5: 数据库字段标记为可选（placeholder: "留空则管理所有数据库"）

- [ ] **Task 15: 实现各数据库类型的动态表单**
  - [ ] SubTask 15.1: MySQL 表单：主机、端口（默认3306）、用户名（默认root）、密码、数据库（可选）、字符集（默认utf8mb4）
  - [ ] SubTask 15.2: PostgreSQL 表单：主机、端口（默认5432）、用户名（默认postgres）、密码、数据库（可选）、SSL模式（默认prefer）
  - [ ] SubTask 15.3: SQLite 表单：模式选择（内存/文件）、文件路径（文件模式必填）
  - [ ] SubTask 15.4: Oracle 表单：主机、端口（默认1521）、用户名（默认system）、密码、服务名/SID
  - [ ] SubTask 15.5: 表单底部：测试连接按钮（左侧）+ 取消/保存并连接按钮（右侧）

- [ ] **Task 16: 连接创建逻辑适配新 `ConnectionConfig`**
  - [ ] SubTask 16.1: 实现 `buildConfig()` 函数，根据表单数据生成结构化 `ConnectionConfig`
  - [ ] SubTask 16.2: 实现 `handleTestConnection()`：先构建 config，再调用 `testConnection` API
  - [ ] SubTask 16.3: 实现 `handleSave()`：先构建 config，再调用 `connect` API，成功后更新 store
  - [ ] SubTask 16.4: 数据库为空时，连接字符串不包含 `/database`，驱动兼容无数据库的连接

## 阶段五：清理与验证

- [ ] **Task 17: 清理旧组件与代码**
  - [ ] SubTask 17.1: 删除 `packages/connection/src/components/ConnectionPanel.vue`
  - [ ] SubTask 17.2: 删除 `packages/schema/src/components/SchemaTree.vue`（或保留为空壳，待后续移除）
  - [ ] SubTask 17.3: 更新 `packages/connection/src/index.ts` 导出，移除 `ConnectionPanel`，新增 `ConnectionTree` 和 `ConnectionDialog`
  - [ ] SubTask 17.4: 更新 `packages/schema/src/index.ts` 导出，移除 `SchemaTree`
  - [ ] SubTask 17.5: 清理 `MainLayout.vue` 中不再使用的 import 和逻辑

- [ ] **Task 18: 代码规范与质量验证**
  - [ ] SubTask 18.1: Rust: `cargo clippy` 严格模式零警告
  - [ ] SubTask 18.2: Rust: `cargo test`（含集成测试）全部通过
  - [ ] SubTask 18.3: 前端: ESLint + Prettier 零错误
  - [ ] SubTask 18.4: 前端: `vue-tsc --noEmit` 零类型错误
  - [ ] SubTask 18.5: `cargo build --release` 成功
  - [ ] SubTask 18.6: 前端 `pnpm build` 成功

# Task Dependencies

- Task 2 (ConnectionConfig 重构) 依赖 Task 1（元数据结构已定义）
- Task 3 (MySQL 驱动) 依赖 Task 1 和 Task 2
- Task 4 (PostgreSQL 驱动) 依赖 Task 1 和 Task 2
- Task 5 (SQLite 驱动) 依赖 Task 1 和 Task 2
- Task 6 (ConnectionManager + Tauri) 依赖 Task 2、Task 3、Task 4、Task 5
- Task 7 (前端类型) 依赖 Task 1（元数据结构定义完成，可并行进行类型定义）
- Task 8 (数据库类型配置) 独立
- Task 9 (ConnectionTree 核心) 依赖 Task 7 和 Task 8
- Task 10 (右键菜单) 依赖 Task 9
- Task 11 (拖拽排序) 依赖 Task 9
- Task 12 (对象节点交互) 依赖 Task 9 和 Task 6
- Task 13 (MainLayout 集成) 依赖 Task 9 和 Task 14
- Task 14 (ConnectionDialog) 依赖 Task 8
- Task 15 (动态表单) 依赖 Task 14
- Task 16 (连接创建逻辑) 依赖 Task 15 和 Task 7
- Task 17 (清理) 依赖 Task 13 和 Task 16
- Task 18 (验证) 依赖所有前置任务

**可并行执行的分组：**
- 分组 A (后端元数据): Task 1 先完成，然后 Task 2/3/4/5 可并行
- 分组 B (前端类型+配置): Task 7 和 Task 8 可并行（与分组 A 也可并行）
- 分组 C (ConnectionTree): Task 9 先完成，然后 Task 10/11/12 可并行
- 分组 D (ConnectionDialog): Task 14 → Task 15 → Task 16 串行
- 分组 C 和 分组 D 可并行
