# Tasks

## 阶段一：前端基础架构

- [x] Task 1: 创建 pnpm monorepo workspace 结构
  - [x] SubTask 1.1: 在根目录创建 `pnpm-workspace.yaml`，定义 workspace 包路径
  - [x] SubTask 1.2: 创建 `apps/desktop/package.json`，继承当前前端依赖并添加新依赖
  - [x] SubTask 1.3: 创建 `packages/core/package.json`、`packages/components/package.json` 等基础包
  - [x] SubTask 1.4: 调整根目录 `package.json`，改为 monorepo 管理脚本
  - [x] SubTask 1.5: 运行 `pnpm install` 验证 workspace 链接正确

- [x] Task 2: 建立前端应用壳与核心布局
  - [x] SubTask 2.1: 在 `apps/desktop/src` 创建目录结构（views、layouts、components、stores、router、i18n、styles）
  - [x] SubTask 2.2: 实现 `MainLayout.vue`：包含顶部标题栏、左侧面板、右侧主区域、底部状态栏
  - [x] SubTask 2.3: 实现可拖拽调整大小的面板分割器（使用 naive-ui 或自研）
  - [x] SubTask 2.4: 更新 `main.ts`，引入布局并挂载
  - [x] SubTask 2.5: 更新 `index.html` 标题为 Linkbase

- [x] Task 3: 配置 Vue Router 4
  - [x] SubTask 3.1: 在 `packages/core/src/router/index.ts` 创建路由配置
  - [x] SubTask 3.2: 定义路由：`/`（主工作区）、`/settings`（设置）
  - [x] SubTask 3.3: 在 `MainLayout` 中集成 `<router-view>`

- [x] Task 4: 配置 Pinia 状态管理
  - [x] SubTask 4.1: 在 `packages/core/src/stores/app.ts` 创建 `useAppStore`（主题、语言、布局）
  - [x] SubTask 4.2: 在 `packages/core/src/stores/connection.ts` 创建 `useConnectionStore`
  - [x] SubTask 4.3: 在 `packages/core/src/stores/editor.ts` 创建 `useEditorStore`
  - [x] SubTask 4.4: 在 `packages/core/src/stores/result.ts` 创建 `useResultStore`
  - [x] SubTask 4.5: 在 `main.ts` 中注册 Pinia

- [x] Task 5: 实现主题系统
  - [x] SubTask 5.1: 在 `packages/core/src/styles/theme.css` 定义 CSS 变量（亮色/暗色）
  - [x] SubTask 5.2: 在 `packages/core/src/composables/useTheme.ts` 创建主题组合式函数
  - [x] SubTask 5.3: 实现主题切换逻辑，持久化到 localStorage
  - [x] SubTask 5.4: 配置 Tailwind CSS 使用 CSS 变量
  - [x] SubTask 5.5: 在布局中添加主题切换按钮

- [x] Task 6: 实现国际化 (i18n)
  - [x] SubTask 6.1: 安装 `vue-i18n`，在 `packages/core/src/i18n/index.ts` 创建 i18n 实例
  - [x] SubTask 6.2: 创建 `packages/core/src/i18n/locales/zh-CN.ts` 和 `en.ts`
  - [x] SubTask 6.3: 实现语言切换逻辑，持久化到 localStorage
  - [x] SubTask 6.4: 在布局中添加语言切换按钮
  - [x] SubTask 6.5: 确保所有 UI 文本通过 `$t` 或 `t` 函数渲染

## 阶段二：Rust 后端架构

- [x] Task 7: 拆分 Rust crate 结构
  - [x] SubTask 7.1: 在 `src-tauri/crates/` 下创建 `core`、`db-common`、`drivers/sqlite-driver` 目录
  - [x] SubTask 7.2: 为每个 crate 创建 `Cargo.toml`，配置 workspace 成员
  - [x] SubTask 7.3: 在根 `Cargo.toml` 中定义 workspace
  - [x] SubTask 7.4: 调整 `src-tauri/Cargo.toml`，依赖本地 crates
  - [x] SubTask 7.5: 运行 `cargo check` 验证 crate 链接正确

- [x] Task 8: 实现驱动抽象层 (db-common)
  - [x] SubTask 8.1: 在 `db-common/src/lib.rs` 定义 `DbDriver` trait
  - [x] SubTask 8.2: 定义 `QueryResult` trait 及相关结构体
  - [x] SubTask 8.3: 定义 `Metadata` trait 及相关结构体
  - [x] SubTask 8.4: 定义 `CancellableQuery` trait
  - [x] SubTask 8.5: 定义统一的 `AppError` 错误类型（flat struct，支持 code、message、detail、suggestion）

- [x] Task 9: 实现 SQLite 驱动
  - [x] SubTask 9.1: 在 `sqlite-driver/Cargo.toml` 添加 `rusqlite` 依赖
  - [x] SubTask 9.2: 实现 `SqliteDriver` struct 及 `DbDriver` trait
  - [x] SubTask 9.3: 实现连接管理（文件路径、内存数据库）
  - [x] SubTask 9.4: 实现查询执行与结果集返回（区分 SELECT 和修改语句）
  - [x] SubTask 9.5: 实现元数据获取（表列表、列信息）

- [x] Task 10: 实现 core 连接与查询管理
  - [x] SubTask 10.1: 在 `core/src/lib.rs` 创建连接管理器（ConnectionManager）
  - [x] SubTask 10.2: 实现连接池/单连接生命周期管理
  - [x] SubTask 10.3: 实现查询调度机制
  - [x] SubTask 10.4: 集成 SQLite 驱动，支持动态选择驱动

- [x] Task 11: 实现 Tauri 命令层
  - [x] SubTask 11.1: 在 `src-tauri/src/lib.rs` 定义 Tauri commands
  - [x] SubTask 11.2: 实现 `connect`、`disconnect`、`execute_sql`、`get_metadata`
  - [x] SubTask 11.3: 统一错误处理，返回标准错误 JSON 格式（flat struct AppError）
  - [x] SubTask 11.4: 注册 commands 到 Tauri Builder

## 阶段三：前后端集成与验证

- [x] Task 12: 前端 Tauri invoke 封装层
  - [x] SubTask 12.1: 在 `packages/core/src/api/index.ts` 创建封装函数
  - [x] SubTask 12.2: 定义 TypeScript 类型（ConnectionConfig、QueryResult、AppError）
  - [x] SubTask 12.3: 实现 `connect`、`disconnect`、`executeSql`、`getMetadata` 函数
  - [x] SubTask 12.4: 确保所有 store 通过封装层调用后端，不直接使用 `invoke`

- [x] Task 13: 实现基础连接管理 UI
  - [x] SubTask 13.1: 在 `packages/connection/src/components/ConnectionPanel.vue` 创建连接列表面板
  - [x] SubTask 13.2: 实现新建 SQLite 连接表单（文件选择、内存选项）
  - [x] SubTask 13.3: 实现连接测试与连接/断开功能
  - [x] SubTask 13.4: 在左侧面板集成 ConnectionPanel

- [x] Task 14: 实现基础 SQL 编辑器与结果展示
  - [x] SubTask 14.1: 在 `packages/editor/src/components/SqlEditor.vue` 创建基础编辑器（等宽 textarea + sql:fill 事件）
  - [x] SubTask 14.2: 实现执行 SQL 按钮与快捷键（Ctrl+Enter）
  - [x] SubTask 14.3: 在 `packages/result/src/components/ResultPanel.vue` 创建结果展示（NDataTable 虚拟滚动，修改语句友好提示）
  - [x] SubTask 14.4: 集成编辑器与结果面板到主工作区

- [x] Task 15: 端到端验证
  - [x] SubTask 15.1: 运行 `pnpm dev` 启动应用
  - [x] SubTask 15.2: 测试新建 SQLite 内存连接
  - [x] SubTask 15.3: 测试执行 `SELECT 1` 并查看结果
  - [x] SubTask 15.4: 测试主题切换与语言切换
  - [x] SubTask 15.5: 验证 Rust 编译通过
  - [x] SubTask 15.6: 零 TS 诊断错误

## 额外完成项（Bug 修复）

- [x] 修复 `AppError` 从 enum → flat struct，确保 Tauri 序列化 JSON 有顶层 `message`
- [x] 修复前端连接 ID 不一致（后端 UUID 替换前端本地 ID）
- [x] 无边框窗口 + 自定义标题栏窗口控制（decorations: false）
- [x] SQLite 驱动区分 SELECT 和 INSERT/UPDATE/DELETE 执行路径
- [x] 表列表浏览 + 双击填充 SQL
- [x] TS 诊断清零（tsconfig paths + 显式类型标注）

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 2
- Task 5 依赖 Task 2
- Task 6 依赖 Task 2
- Task 8 依赖 Task 7
- Task 9 依赖 Task 8
- Task 10 依赖 Task 9
- Task 11 依赖 Task 10
- Task 12 依赖 Task 11
- Task 13 依赖 Task 12
- Task 14 依赖 Task 12
- Task 15 依赖 Task 13 和 Task 14
