# Tasks

## 阶段一：Rust 后端 — 元数据结构重构

- [x] **Task 1: 重构 `DatabaseMetadata` 及关联结构体**
  - [x] SubTask 1.1: 在 `db-common/src/lib.rs` 中定义新的结构体
  - [x] SubTask 1.2: 扩展 `TableInfo`，新增 `schema`、`indexes`、`constraints` 字段
  - [x] SubTask 1.3: 扩展 `ColumnInfo`，新增 `nullable`、`default_value`、`is_primary_key` 字段
  - [x] SubTask 1.4: 调整 `DbDriver` trait 中 `get_metadata` 的返回类型签名
  - [x] SubTask 1.5: 运行 `cargo check` 确保 db-common 编译通过

- [x] **Task 2: 重构 `ConnectionConfig` 结构体**
  - [x] SubTask 2.1: 在 `db-common/src/lib.rs` 中将 `ConnectionConfig` 改为结构化字段
  - [x] SubTask 2.2: 保留 `options: serde_json::Value` 字段
  - [x] SubTask 2.3: 运行 `cargo check` 确保编译通过

- [x] **Task 3: 扩展 MySQL 驱动 `get_metadata`**
  - [x] SubTask 3.1: 查询 `information_schema.SCHEMATA` 获取所有数据库列表
  - [x] SubTask 3.2: 对每个数据库，分别查询 tables、columns、views、routines
  - [x] SubTask 3.3: 查询用户列表
  - [x] SubTask 3.4: 组装为 `DatabaseMetadata` 返回
  - [x] SubTask 3.5: 更新 MySQL 驱动的 `connect` 方法
  - [x] SubTask 3.6: 运行 `cargo test -p mysql-driver` 验证

- [x] **Task 4: 扩展 PostgreSQL 驱动 `get_metadata`**
  - [x] SubTask 4.1: 查询 `information_schema.schemata` 获取所有模式
  - [x] SubTask 4.2: 对每个模式，查询 tables/views/materialized_views/routines/sequences
  - [x] SubTask 4.3: 查询索引和约束
  - [x] SubTask 4.4: 查询用户/角色
  - [x] SubTask 4.5: 组装为 `DatabaseMetadata` 返回
  - [x] SubTask 4.6: 更新 PostgreSQL 驱动的 `connect` 方法
  - [x] SubTask 4.7: 运行 `cargo test -p postgres-driver` 验证

- [x] **Task 5: 扩展 SQLite 驱动 `get_metadata`**
  - [x] SubTask 5.1: 从 `sqlite_master` 查询 `type='table'` 和 `type='view'`
  - [x] SubTask 5.2: 扩展 `PRAGMA table_info` 获取字段信息
  - [x] SubTask 5.3: 查询索引信息
  - [x] SubTask 5.4: 组装为 `DatabaseMetadata` 返回
  - [x] SubTask 5.5: 运行 `cargo test -p sqlite-driver` 验证

- [x] **Task 6: 更新 ConnectionManager 与 Tauri 命令层**
  - [x] SubTask 6.1: 在 `core/src/lib.rs` 中更新 `connect` 方法
  - [x] SubTask 6.2: 在 `core/src/lib.rs` 中新增 `get_enhanced_metadata` 方法
  - [x] SubTask 6.3: 在 `src/lib.rs` 中新增 `get_enhanced_metadata` Tauri 命令
  - [x] SubTask 6.4: 运行 `cargo build` 确保全仓编译通过

## 阶段二：前端 — 类型与 Store 更新

- [x] **Task 7: 更新前端 TypeScript 类型定义**
  - [x] SubTask 7.1-7.6: 定义新接口、更新 `ConnectionConfig`、新增 API 函数和 store 方法

- [x] **Task 8: 创建数据库类型配置定义**
  - [x] SubTask 8.1: 定义每种数据库类型的配置
  - [x] SubTask 8.2: 定义每种数据库类型的节点结构模板

## 阶段三：前端 — ConnectionTree 组件

- [x] **Task 9: 创建 `ConnectionTree.vue` 核心组件**
  - [x] SubTask 9.1-9.6: 创建组件骨架、实现树构建、节点渲染、懒加载元数据

- [x] **Task 10: 实现 ConnectionTree 右键菜单**
  - [x] SubTask 10.1-10.6: 各节点类型的右键菜单

- [x] **Task 11: 实现拖拽排序功能**
  - [x] SubTask 11.1-11.4: 连接和分组拖拽、持久化、视觉反馈

- [x] **Task 12: 实现对象节点交互**
  - [x] SubTask 12.1-12.5: 双击执行、展开列信息、搜索过滤

- [x] **Task 13: 更新 MainLayout 集成 ConnectionTree**
  - [x] SubTask 13.1-13.3: 移除旧组件、集成新组件、适配回调

## 阶段四：前端 — 创建连接弹窗重构

- [x] **Task 14: 创建 `ConnectionDialog.vue` 左列表右表单布局**
  - [x] SubTask 14.1-14.5: 布局结构、左侧数据库列表、右侧动态表单

- [x] **Task 15: 实现各数据库类型的动态表单**
  - [x] SubTask 15.1-15.5: MySQL/PostgreSQL/SQLite/Oracle 表单

- [x] **Task 16: 连接创建逻辑适配新 `ConnectionConfig`**
  - [x] SubTask 16.1-16.4: buildConfig、handleTestConnection、handleSave

## 阶段五：清理与验证

- [ ] **Task 17: 清理旧组件与代码**
  - [ ] SubTask 17.1: 删除 `packages/connection/src/components/ConnectionPanel.vue`
  - [ ] SubTask 17.2: 删除 `packages/schema/src/components/SchemaTree.vue`
  - [ ] SubTask 17.3: 更新 `packages/connection/src/index.ts` 导出
  - [ ] SubTask 17.4: 更新 `packages/schema/src/index.ts` 导出
  - [ ] SubTask 17.5: 清理 `MainLayout.vue` 中不再使用的 import

- [ ] **Task 18: 代码规范与质量验证**
  - [ ] SubTask 18.1: Rust: `cargo clippy` 严格模式零警告
  - [ ] SubTask 18.2: Rust: `cargo test` 全部通过
  - [ ] SubTask 18.3: 前端: ESLint + Prettier 零错误
  - [ ] SubTask 18.4: 前端: `vue-tsc --noEmit` 零类型错误
  - [ ] SubTask 18.5: `cargo build --release` 成功
  - [ ] SubTask 18.6: 前端 `pnpm build` 成功

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3/4/5 依赖 Task 1 和 Task 2
- Task 6 依赖 Task 2/3/4/5
- Task 7/8 独立，可并行
- Task 9-12 依赖 Task 7/8
- Task 13 依赖 Task 9/14
- Task 14-16 串行
- Task 17 依赖 Task 13/16
- Task 18 依赖所有前置任务
