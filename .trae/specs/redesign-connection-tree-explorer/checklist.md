# Checklist

## Rust 后端

- [x] `DatabaseMetadata` 结构体新增 `driver_type`、`databases`、`schemas` 字段，`tables` 字段保留兼容
- [x] `DatabaseInfo` 结构体包含 name、tables、views、functions、procedures、users
- [x] `SchemaInfo` 结构体包含 name、tables、views、materialized_views、functions、procedures、sequences、indexes
- [x] `TableInfo` 新增 schema、indexes、constraints 字段
- [x] `ColumnInfo` 新增 nullable、default_value、is_primary_key 字段
- [x] `ViewInfo`、`RoutineInfo`、`SequenceInfo`、`IndexInfo`、`ConstraintInfo`、`UserInfo` 全部定义并派生 Serialize/Deserialize
- [x] `ConnectionConfig` 重构为结构化字段：host、port、user、password、database 分离，connection_string 改为 Option
- [x] MySQL 驱动 `get_metadata` 返回所有数据库及其 tables、views、functions、procedures、users
- [x] PostgreSQL 驱动 `get_metadata` 返回所有模式及其 tables、views、materialized_views、functions、procedures、sequences、indexes、roles
- [x] SQLite 驱动 `get_metadata` 区分 table/view，返回 indexes
- [x] MySQL 驱动 `connect` 适配新结构化 ConnectionConfig
- [x] PostgreSQL 驱动 `connect` 适配新结构化 ConnectionConfig
- [x] `ConnectionManager` 新增 `get_enhanced_metadata` 方法
- [x] Tauri 命令层新增 `get_enhanced_metadata` 命令
- [x] `cargo check` 全仓零错误
- [ ] `cargo clippy` 零警告
- [ ] `cargo test` 全部通过
- [ ] `cargo build --release` 成功

## 前端 — 类型与 Store

- [x] `DatabaseMetadata` TypeScript 接口与 Rust 结构体字段一致
- [x] `DatabaseInfo`、`SchemaInfo`、`TableInfo`、`ViewInfo`、`RoutineInfo`、`SequenceInfo`、`IndexInfo`、`ConstraintInfo`、`UserInfo` TypeScript 接口完整
- [x] `ConnectionConfig` TypeScript 接口匹配 Rust 结构化字段
- [x] `DriverType` 枚举类型定义
- [x] `getEnhancedMetadata` API 函数已添加
- [x] `Connection` Store 接口新增 host、port、user、database 字段
- [x] `connectionOrder`、`folderOrder` 状态及 `moveConnection`、`moveFolder` 方法已实现
- [x] `database-types.ts` 定义每种数据库类型的名称、图标、默认端口、默认用户名、表单字段配置
- [x] `database-types.ts` 定义每种数据库类型的树节点结构模板

## 前端 — ConnectionTree 组件

- [x] `ConnectionTree.vue` 使用 `NTree` 组件渲染
- [x] `buildTree()` 根据 store 连接列表和分组生成树节点
- [x] 连接节点显示数据库类型图标、连接名称、在线/离线状态指示器
- [x] 分组节点显示文件夹图标、分组名称、展开/折叠状态
- [x] 展开已连接节点时懒加载元数据并构建对象子节点
- [x] SQLite 连接：直接展示 Tables、Views 分类
- [x] MySQL 连接：展示 Databases → 每库 Tables/Views/Functions/Procedures/Users
- [x] PostgreSQL 连接：展示 Schemas → 每模式 Tables/Views/Materialized Views/Functions/Sequences/Indexes
- [x] 对象节点按类别分组展示，不同图标区分表/视图/函数等
- [x] 右键菜单：分组节点（新建连接/重命名/删除）
- [x] 右键菜单：连接节点（连接/断开/编辑/测试/删除/移到分组）
- [x] 右键菜单：表节点（生成SELECT/复制表名/复制DDL/查看详情）
- [x] 右键菜单：视图节点（生成SELECT/复制DDL）
- [x] 右键菜单：函数/存储过程节点（生成调用语句/复制名称）
- [x] 右键菜单：空白处（新建连接/新建分组）
- [x] 拖拽连接到不同分组或调整顺序，持久化
- [x] 拖拽分组调整顺序，持久化
- [x] 拖拽视觉反馈：目标位置高亮
- [x] 双击表名生成 `SELECT * FROM <table> LIMIT 100` 并执行
- [x] 双击视图名生成 `SELECT * FROM <view> LIMIT 100` 并执行
- [x] 展开表节点显示列信息
- [x] 搜索框模糊搜索连接名/表名/列名，过滤树节点

## 前端 — ConnectionDialog 组件

- [x] `ConnectionDialog.vue` 使用 `LModal` 作为容器
- [x] 左侧：数据库类型图标列表（SQLite/MySQL/PostgreSQL/Oracle），选中高亮
- [x] 右侧：根据选中数据库类型动态渲染表单
- [x] 连接名称默认值随用户名变化自动更新为 `{用户名}@localhost`
- [x] 数据库字段标记为可选（placeholder 提示）
- [x] MySQL 表单字段与默认值正确
- [x] PostgreSQL 表单字段与默认值正确
- [x] SQLite 表单字段与默认值正确
- [x] Oracle 表单字段与默认值正确
- [x] 表单底部：测试连接（左）+ 取消/保存并连接（右）
- [x] `buildConfig()` 生成结构化 ConnectionConfig
- [x] `handleTestConnection()` 调用 testConnection API 并展示结果
- [x] `handleSave()` 调用 connect API，成功后更新 store 并关闭弹窗

## 前端 — MainLayout 集成

- [x] 侧边栏移除旧的 `ConnectionPanel` 引用
- [x] 侧边栏移除旧的 `SchemaTree` 引用
- [x] 集成 `ConnectionTree` 组件，占满整个侧边栏
- [x] 侧边栏高度限制已移除
- [x] 编辑器/结果面板的双击执行回调适配 ConnectionTree 事件

## 清理

- [x] `ConnectionPanel.vue` 已删除
- [x] `SchemaTree.vue` 已删除
- [x] `packages/connection/src/index.ts` 导出更新
- [x] `packages/schema/src/index.ts` 导出更新
- [x] `MainLayout.vue` 不再使用的 import 已清理

## 代码质量

- [ ] ESLint 零错误
- [ ] Prettier 零错误
- [x] `vue-tsc --noEmit` 零类型错误
- [x] `pnpm build` 成功
