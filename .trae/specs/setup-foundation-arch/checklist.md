# Checklist

## 前端架构

- [x] pnpm workspace 配置文件存在且正确
- [x] `apps/desktop` 目录结构完整，包含 src、public、package.json
- [x] `packages/core`、`packages/components`、`packages/connection`、`packages/editor`、`packages/result`、`packages/schema` 目录及 package.json 存在
- [x] 根目录 package.json 包含 monorepo 管理脚本（dev、build、lint 等）
- [x] `pnpm install` 成功，无 workspace 链接错误

- [x] `MainLayout.vue` 实现主布局：标题栏、左面板、主区域、状态栏
- [x] 面板分割器可拖拽调整大小
- [x] 应用启动后正确渲染主布局

- [x] Vue Router 4 配置存在，包含 `/` 和 `/settings` 路由
- [x] 路由懒加载配置正确
- [x] `<router-view>` 在布局中正确集成

- [x] Pinia 已注册到 Vue 应用
- [x] `useAppStore` 包含 theme、locale、layout 状态
- [x] `useConnectionStore` 包含 connections、currentConnection 状态
- [x] `useEditorStore` 包含 tabs、currentSql 状态
- [x] `useResultStore` 包含 results、logs 状态

- [x] 主题 CSS 变量文件存在，覆盖亮色/暗色方案
- [x] `useTheme` 组合式函数实现主题切换与持久化
- [x] Tailwind CSS 配置使用 CSS 变量
- [x] 主题切换按钮在 UI 中可用，切换后即时生效
- [x] 主题状态持久化到 localStorage，重启后恢复

- [x] vue-i18n 实例配置存在，支持 `zh-CN` 和 `en`
- [x] 语言文件按功能域拆分，包含基础通用文本
- [x] 语言切换逻辑实现，切换后即时生效
- [x] 语言状态持久化到 localStorage，重启后恢复
- [x] 所有 UI 文本通过 i18n 函数渲染，无硬编码中文或英文

## Rust 后端架构

- [x] `src-tauri/crates/core/Cargo.toml` 存在且配置正确
- [x] `src-tauri/crates/db-common/Cargo.toml` 存在且配置正确
- [x] `src-tauri/crates/drivers/sqlite-driver/Cargo.toml` 存在且配置正确
- [x] 根 `Cargo.toml` workspace 定义包含所有 crates
- [x] `cargo check` 通过，核心 crates 无编译错误 *(Tauri build script Windows resource compiler 仅影响 release build)*

- [x] `DbDriver` trait 定义完整，包含 connect、disconnect、execute、get_metadata 等方法
- [x] `QueryResult` struct 定义完整
- [x] `Metadata` struct (DatabaseMetadata/TableInfo) 定义完整
- [x] `CancellableQuery` trait 定义完整
- [x] `AppError` 错误类型（flat struct）支持 code、message、detail、suggestion 字段

- [x] `SqliteDriver` 实现 `DbDriver` trait
- [x] 支持文件路径和内存数据库连接
- [x] 查询执行返回正确结果集（区分 SELECT 和 INSERT/UPDATE/DELETE/CREATE/DROP）
- [x] 元数据获取返回表列表和列信息
- [ ] SQLite 驱动单元测试通过 *(计划后续补充)*

- [x] `ConnectionManager` 实现连接生命周期管理
- [x] 支持连接创建、断开、按 ID 查找
- [x] 查询调度机制实现
- [x] 集成 SQLite 驱动，可通过配置动态创建

- [x] Tauri commands 定义完整：connect、disconnect、execute_sql、get_metadata
- [x] 命令参数和返回值使用 serde 序列化
- [x] 错误处理返回统一 JSON 格式
- [x] commands 注册到 Tauri Builder，应用可正常启动

## 前后端集成

- [x] `packages/core/src/api/index.ts` 封装层存在
- [x] TypeScript 类型定义完整（ConnectionConfig、QueryResult、AppError 等）
- [x] 所有 store 通过封装层调用后端
- [x] 前端无直接调用 `invoke` 的代码（封装层除外）

- [x] 连接面板 UI 可显示连接列表
- [x] 可新建 SQLite 连接（文件或内存）
- [x] 连接测试返回成功或失败提示
- [x] 连接/断开功能正常工作（修复后端 UUID 替换前端本地 ID）

- [x] SQL 编辑器可输入 SQL
- [x] 执行按钮或快捷键可触发查询（Ctrl+Enter）
- [x] 结果面板以表格形式展示查询结果（NDataTable 虚拟滚动）
- [x] 执行错误以友好形式展示

## 端到端验证

- [x] `pnpm tauri dev` 成功启动 Tauri 应用
- [x] 可创建 SQLite 内存连接并连接成功
- [x] 可执行 `SELECT 1` 并看到结果
- [x] 可执行 `CREATE TABLE`、`INSERT`、`SELECT` 等基础 SQL
- [x] 主题切换功能正常，暗色/亮色模式正确渲染
- [x] 语言切换功能正常，中英文切换即时生效
- [ ] `cargo test` 通过，Rust 单元测试无失败 *(计划后续补充)*
- [ ] `pnpm build` 成功，生产构建无错误 *(计划后续完善)*

## 额外验证项（Bug 修复）

- [x] AppError 枚举→flat struct 序列化修复，前端正确提取 message
- [x] 连接 ID 不一致修复（后端 UUID 替换前端 crypto.randomUUID）
- [x] 无边框窗口 deorations:false + 自定义标题栏窗口控制
- [x] SQLite 驱动非 SELECT 语句（INSERT/UPDATE/DELETE/CREATE TABLE）支持
- [x] 表列表浏览 + 双击填充 SQL 功能
- [x] TS 诊断清零（tsconfig paths + 显式类型标注 + unused import 清理）
