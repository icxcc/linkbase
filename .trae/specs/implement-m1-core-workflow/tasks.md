# M1 核心工作闭环任务列表

## 阶段一：Rust 后端 — MySQL/PostgreSQL 驱动

- [ ] **Task 1: 创建 MySQL 驱动 crate**
  - [ ] 创建 `crates/drivers/mysql-driver/` 目录和 `Cargo.toml`，依赖 `sqlx` (MySQL feature)
  - [ ] 实现 `DbDriver` trait：`connect` / `disconnect` / `execute` / `get_metadata`
  - [ ] 实现 `CancellableQuery` trait（`KILL QUERY`）
  - [ ] `connect` 支持 host/port/user/password/database/charset 参数
  - [ ] `execute` 自动区分 SELECT 查询与 DML 语句
  - [ ] `get_metadata` 查询 `information_schema.TABLES` 和 `information_schema.COLUMNS` 获取表与列信息
  - [ ] 编写集成测试（使用 `testcontainers` 启动 MySQL 实例）

- [ ] **Task 2: 创建 PostgreSQL 驱动 crate**
  - [ ] 创建 `crates/drivers/postgres-driver/` 目录和 `Cargo.toml`，依赖 `sqlx` (PostgreSQL feature)
  - [ ] 实现 `DbDriver` trait：`connect` / `disconnect` / `execute` / `get_metadata`
  - [ ] 实现 `CancellableQuery` trait（`pg_cancel_backend`）
  - [ ] `connect` 支持 host/port/user/password/database/sslmode 参数
  - [ ] `execute` 自动区分 SELECT 查询与 DML 语句
  - [ ] `get_metadata` 查询 `information_schema.tables` 和 `information_schema.columns` 获取按 schema 分组的表与列信息
  - [ ] 编写集成测试（使用 `testcontainers` 启动 PostgreSQL 实例）

- [ ] **Task 3: 扩展 ConnectionManager 支持多驱动**
  - [ ] 在 `core` crate 中注册 MySQL 和 PostgreSQL 驱动（feature-gated）
  - [ ] 扩展 `ConnectionConfig` 结构体，增加 MySQL/PostgreSQL 专用字段
  - [ ] `ConnectionManager::connect` 根据 `driver_type` 动态选择驱动
  - [ ] 实现 `cancel_query` 方法，通过驱动层的 `CancellableQuery` 取消查询
  - [ ] 实现 `test_connection` 方法，返回延迟、版本、SSL 状态等诊断信息
  - [ ] 更新 Tauri 命令层：新增 `cancel_query` 和 `test_connection` 命令
  - [ ] 更新 `AppError`：新增 `ERR_CONN_TIMEOUT`、`ERR_QUERY_CANCELLED`、`ERR_DRIVER_NOT_FOUND`、`ERR_SSH_TUNNEL`

## 阶段二：前端 — Monaco Editor 集成

- [ ] **Task 4: 安装 Monaco Editor 依赖并配置**
  - [ ] 安装 `monaco-editor`、`@monaco-editor/loader` 及相关类型包
  - [ ] 配置 Vite 对 Monaco Editor worker 的支持
  - [ ] 创建 `packages/editor/src/composables/useMonaco.ts` 封装 Monaco 初始化与语言配置

- [ ] **Task 5: 实现 SQL 方言语法高亮与补全**
  - [ ] 为 SQLite / MySQL / PostgreSQL 配置对应的 Monaco 语言支持
  - [ ] 实现 `CompletionProvider`：根据当前连接数据库方言提供关键字补全
  - [ ] 实现表名补全：通过 `get_metadata` 获取表列表并注册为补全项
  - [ ] 实现列名补全：解析上下文 SQL，当用户输入 `table.` 或 `FROM table WHERE` 时提供列名
  - [ ] 实现代码片段系统：内置常用片段（如 `sel` → `SELECT * FROM`），支持用户自定义
  - [ ] 前端 API 层新增 `getMetadata` 调用，提供补全所需元数据

- [ ] **Task 6: 实现多标签页编辑器 UI**
  - [ ] 更新 `SqlEditor.vue`：替换 `<textarea>` 为 Monaco Editor 实例
  - [ ] 实现标签栏组件 `EditorTabs.vue`：展示标签页、新建/关闭按钮、拖拽排序、右键菜单（关闭/关闭其他/关闭右侧）
  - [ ] 标签页支持重命名（双击标签名进入编辑）
  - [ ] 标签页标记未保存状态（`*` 前缀）
  - [ ] 标签页内容与 `useEditorStore` 状态双向绑定
  - [ ] 实现"执行全部"、"执行选中"、"逐条执行"三种模式
  - [ ] 实现事务控件按钮（开始/提交/回滚）在编辑器工具栏，状态与当前连接关联

- [ ] **Task 7: 实现 SQL 格式化功能**
  - [ ] 集成 `sql-formatter` 库
  - [ ] 实现美化/压缩两种格式化操作
  - [ ] 快捷键绑定（如 `Ctrl+Shift+F` 格式化）
  - [ ] 支持 MySQL/PostgreSQL/SQLite 方言格式化

## 阶段三：前端 — 虚拟滚动结果表格

- [ ] **Task 8: 创建虚拟滚动表格组件**
  - [ ] 在 `packages/result/` 中创建 `LVirtualTable.vue` 组件
  - [ ] 基于 `@tanstack/virtual` 实现虚拟滚动，支持动态行高
  - [ ] 实现列宽拖拽调整
  - [ ] 实现列排序（客户端，点击列头切换 asc/desc/none）
  - [ ] 实现列过滤（输入过滤文本，客户端匹配）
  - [ ] 实现固定列（左侧固定）
  - [ ] 实现隐藏/显示列

- [ ] **Task 9: 实现表格数据操作功能**
  - [ ] 单元格双击进入编辑模式，Enter 确认、Escape 取消
  - [ ] 修改后的行高亮显示（变更标记）
  - [ ] NULL 值以差异样式显式显示（灰色斜体 "(NULL)"）
  - [ ] 多格式复制：右键菜单支持 TSV/CSV/JSON/Markdown/INSERT 格式
  - [ ] 行号显式显示
  - [ ] 实现行选择（单击选中行，Ctrl+Click 多选）

- [ ] **Task 10: 替换 M0 ResultPanel 为虚拟表格**
  - [ ] 更新 `ResultPanel.vue`：移除 Naive UI `NDataTable`，引入 `LVirtualTable`
  - [ ] 更新 `useResultStore`：确保数据结构与虚拟表格所需格式一致
  - [ ] 保持加载状态、错误提示、空状态、执行信息展示功能不变

## 阶段四：前端 — 连接管理全功能

- [ ] **Task 11: 连接测试与诊断**
  - [ ] 在连接编辑表单中增加"测试连接"按钮
  - [ ] 前端调用 `testConnection` API，展示诊断结果（延迟、版本、SSL 状态）
  - [ ] 测试结果以 Modal 或 Alert 形式展示

- [ ] **Task 12: 连接文件夹分组**
  - [ ] 扩展 `useConnectionStore`：增加 `folders` 状态（id/name/expanded）
  - [ ] 更新 `ConnectionPanel.vue`：支持按文件夹分组渲染连接列表
  - [ ] 实现文件夹创建/重命名/删除功能
  - [ ] 连接可拖入/拖出文件夹（简化实现：通过右键"移动到文件夹"菜单）

- [ ] **Task 13: 连接导入/导出**
  - [ ] 在连接面板增加"导入配置"/"导出配置"按钮
  - [ ] 导出为 JSON 文件（弹出密码导出警告）
  - [ ] 导入 JSON 文件并解析为连接配置
  - [ ] 冲突处理：重名连接提示覆盖/跳过/重命名

- [ ] **Task 14: 连接状态指示与前端的实时同步**
  - [ ] `useConnectionStore` 增加连接状态字段（idle/connecting/connected/disconnected/reconnecting/error）
  - [ ] `ConnectionPanel.vue` 中连接项显示状态图标/颜色
  - [ ] 底部状态栏显示当前连接状态
  - [ ] 连接断开后自动尝试重连逻辑（可配置开关）

## 阶段五：前端 — 查询历史系统

- [ ] **Task 15: 实现查询历史 Store**
  - [ ] 创建 `packages/core/src/stores/history.ts`：`useHistoryStore`
  - [ ] 定义 `HistoryEntry` 接口（id/sql/connectionName/timestamp/favorited/note）
  - [ ] 实现添加记录、删除记录、清空历史、搜索过滤、收藏/取消收藏、编辑备注
  - [ ] 持久化到 localStorage，限制最大记录数（默认 500 条）

- [ ] **Task 16: 实现查询历史 UI**
  - [ ] 创建 `packages/result/src/components/HistoryPanel.vue`
  - [ ] 在 `ResultPanel.vue` 中增加"历史"标签页
  - [ ] SQL 列表按时间倒序展示，显示连接名、时间、前 80 字符预览
  - [ ] 搜索框实时过滤
  - [ ] 点击记录将 SQL 回填到当前编辑器
  - [ ] 收藏按钮（星标），收藏项固定在顶部

## 阶段六：前端 — Schema 对象浏览器激活

- [ ] **Task 17: 激活 @linkbase/schema 包**
  - [ ] 创建 `packages/schema/src/components/SchemaTree.vue`：树形导航组件
  - [ ] 支持展开/折叠、模糊搜索（表名 + 列名）
  - [ ] 右键菜单：生成 SELECT、复制表名、复制 DDL、删除表
  - [ ] 创建 `packages/schema/src/components/TableDetail.vue`：表详情面板（列信息、索引、约束、DDL 预览）
  - [ ] 双击表名触发 `SELECT * FROM <table> LIMIT 100` 并执行
  - [ ] 在 `MainLayout.vue` 左侧面板集成 `SchemaTree`，替换 M0 的简易表列表

## 阶段七：前端 — 通用组件库激活

- [ ] **Task 18: 激活 @linkbase/components 包**
  - [ ] 实现 `LButton.vue`：primary/secondary/danger/ghost 变体，loading 状态，size 属性
  - [ ] 实现 `LInput.vue`：prefix/suffix icon，clearable，type=password 模式，v-model
  - [ ] 实现 `LModal.vue`：标题、内容插槽、确认/取消按钮、自定义 footer、Esc 关闭
  - [ ] 实现 `LSplitPane.vue`：可拖拽分割面板，支持水平/垂直，slot 传入左右/上下内容
  - [ ] 实现 `LSelect.vue`：下拉选择框，搜索过滤，多选模式
  - [ ] 实现 `LContextMenu.vue`：右键菜单，支持嵌套子菜单，分隔线
  - [ ] 实现 `LTooltip.vue`：悬停提示，支持上下左右位置
  - [ ] 实现 `LIcon.vue`：SVG 图标组件，统一管理图标集
  - [ ] 所有组件支持主题自适应（CSS 变量），导出统一入口 `index.ts`

## 阶段八：前后端集成与 E2E 验证

- [ ] **Task 19: 前后端类型同步与 API 集成**
  - [ ] 更新 TypeScript 类型定义（`ConnectionConfig` 扩展、`TestResult`、`HistoryEntry` 等）
  - [ ] 更新 `@linkbase/core/api` 层：新增 `cancelQuery`、`testConnection`
  - [ ] 更新 `useConnectionStore` 集成新的 API 方法
  - [ ] 执行所有后端命令的端到端验证（连接/查询/取消/元数据 在 MySQL 和 PostgreSQL 上）

- [ ] **Task 20: 代码清理、lint 与构建验证**
  - [ ] Rust: `cargo clippy` 严格模式零警告
  - [ ] Rust: `cargo test`（含集成测试）全部通过
  - [ ] 前端: ESLint + Prettier 零错误
  - [ ] 前端: `vue-tsc --noEmit` 零类型错误
  - [ ] `cargo build --release` 成功
  - [ ] 前端 `pnpm build` 成功

# Task Dependencies

- Task 3 (ConnectionManager 扩展) 依赖于 Task 1 (MySQL) 和 Task 2 (PostgreSQL)
- Task 5 (补全) 依赖于 Task 3（需要多驱动 metadata）和 Task 4（Monaco 安装）
- Task 6 (多标签页 UI) 依赖于 Task 4 (Monaco 安装)
- Task 10 (替换 ResultPanel) 依赖于 Task 8 和 Task 9（虚拟表格组件）
- Task 14 (连接状态同步) 依赖于 Task 3（后端连接管理扩展）
- Task 16 (历史 UI) 依赖于 Task 15（历史 Store）
- Task 17 (Schema 激活) 依赖于 Task 3（多驱动 metadata）
- Task 19 (集成) 依赖于 Task 3、Task 6、Task 10、Task 14、Task 16、Task 17
- Task 20 (验证) 依赖于所有前置任务

**可并行执行的分组：**
- 分组 A (后端驱动): Task 1、Task 2 可并行
- 分组 B (编辑器): Task 4、Task 5、Task 6、Task 7 串行（5 依赖 4，6 依赖 4）
- 分组 C (结果表格): Task 8、Task 9、Task 10 串行
- 分组 D (连接管理): Task 11、Task 12、Task 13、Task 14（11、12、13 可并行）
- 分组 E (历史): Task 15、Task 16 串行
- 分组 F (Schema + 组件): Task 17、Task 18 可并行
- 分组 B、C、D、E、F 可在分组 A 完成后并行推进
