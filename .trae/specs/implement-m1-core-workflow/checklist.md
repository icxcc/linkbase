# M1 核心工作闭环验收清单

## 后端 — MySQL 驱动

- [ ] MySQL 连接：提供正确 host/port/user/password/database，调用 `connect` 返回连接 UUID
- [ ] MySQL 查询：`SELECT` 语句返回包含 columns 和 rows 的 `QueryResult`
- [ ] MySQL DML：`INSERT/UPDATE/DELETE` 语句返回 affected_rows
- [ ] MySQL 元数据：`get_metadata` 返回正确数据库名、表列表、列信息
- [ ] MySQL 查询取消：长查询可通过 `cancel_query` 在 2 秒内终止
- [ ] MySQL 连接错误：错误主机/端口返回 `ERR_CONN_TIMEOUT`
- [ ] MySQL 集成测试：`cargo test -p mysql-driver` 通过

## 后端 — PostgreSQL 驱动

- [ ] PostgreSQL 连接：提供正确 host/port/user/password/database，调用 `connect` 返回连接 UUID
- [ ] PostgreSQL 查询：`SELECT` 语句返回包含 columns 和 rows 的 `QueryResult`
- [ ] PostgreSQL DML：`INSERT/UPDATE/DELETE` 语句返回 affected_rows
- [ ] PostgreSQL 元数据：`get_metadata` 返回带 schema 分组的表列表、列信息
- [ ] PostgreSQL 查询取消：长查询可通过 `cancel_query` 在 2 秒内终止
- [ ] PostgreSQL SSL：sslmode 参数正确生效
- [ ] PostgreSQL 集成测试：`cargo test -p postgres-driver` 通过

## 后端 — ConnectionManager 扩展

- [ ] 多驱动注册：`ConnectionManager` 根据 `driver_type` 正确路由到 MySQL/PostgreSQL/SQLite 驱动
- [ ] `test_connection` 命令：返回延迟、版本、SSL 状态等诊断信息
- [ ] `cancel_query` 命令：取消正在执行的查询，返回成功或错误
- [ ] `AppError` 扩展：所有新增错误码有正确 message/detail/suggestion

## 前端 — Monaco Editor

- [ ] Monaco 初始化：编辑器正常渲染，无控制台错误
- [ ] SQL 语法高亮：根据连接方言（SQLite/MySQL/PostgreSQL）正确高亮
- [ ] 关键字补全：输入 SQL 关键字时触发补全列表
- [ ] 表名补全：`SELECT * FROM ` 后补全列表包含表名
- [ ] 列名补全：`SELECT ` 后补全列表包含列名和关键字
- [ ] 代码片段：`sel` 展开为 `SELECT * FROM`，其他内置片段正常工作
- [ ] 多标签页：新建/关闭/切换/重命名/拖拽排序标签页正常
- [ ] 未保存标记：修改 SQL 后标签显示 `*`
- [ ] 执行全部：`Ctrl+Enter` 执行编辑器全部 SQL
- [ ] 执行选中：选中部分 SQL 后"执行选中"仅执行选中部分
- [ ] 逐条执行：多条分号分隔语句逐条执行显示结果
- [ ] 事务控件：开始/提交/回滚按钮正确显示状态，SQLite 事务生效
- [ ] SQL 格式化：美化/压缩功能正确应用（`Ctrl+Shift+F`）

## 前端 — 虚拟滚动结果表格

- [ ] 虚拟滚动渲染：10 万行数据表格正常渲染，滚动不卡顿
- [ ] 列宽拖拽：拖拽列边界可调整宽度
- [ ] 列排序：点击列头循环切换 asc/desc/none
- [ ] 列过滤：输入过滤文本后表格行实时过滤
- [ ] 固定列：左侧列可固定，水平滚动时不移动
- [ ] 单元格编辑：双击进入编辑模式，Enter 确认，修改行高亮
- [ ] NULL 值显示：NULL 值以灰色斜体 "(NULL)" 显式显示
- [ ] 多格式复制：选中行右键，TSV/CSV/JSON/Markdown/INSERT 复制正确
- [ ] 行号显示：表格左侧显示行号
- [ ] Loading/Error/Empty 状态正确展示

## 前端 — 连接管理全功能

- [ ] 连接测试：点击"测试连接"展示延迟、版本、SSL 状态
- [ ] 文件夹分组：创建/重命名/删除文件夹，连接可分组管理
- [ ] 导出配置：导出连接为 JSON 文件，提示明文警告
- [ ] 导入配置：导入 JSON 文件，重名冲突提示
- [ ] 连接状态指示：idle/connected/disconnected/error 状态图标颜色正确
- [ ] 状态栏同步：底部状态栏实时反映当前连接状态

## 前端 — 查询历史

- [ ] SQL 自动记录：执行 SQL 后自动记录到历史，含时间戳和连接名
- [ ] 历史搜索：输入关键字过滤历史列表
- [ ] 历史回填：点击历史记录将 SQL 回填到编辑器
- [ ] 收藏/取消收藏：星标按钮正确切换，收藏项固定顶部
- [ ] 备注编辑：收藏项可添加/编辑备注
- [ ] 持久化：刷新页面后历史数据保留（localStorage）
- [ ] 数量限制：超过 500 条后旧记录自动清理

## 前端 — Schema 对象浏览器

- [ ] 树形导航：连接 → 数据库 → Schema → Tables/Views 层次展示
- [ ] 展开/折叠：节点展开折叠正常
- [ ] 模糊搜索：搜索"users"可匹配到 users 表和包含 users 列的其它表
- [ ] 右键菜单：生成 SELECT、复制表名、复制 DDL、删除表 菜单项可用
- [ ] 表详情面板：列信息、索引、约束、DDL 预览正确展示
- [ ] 双击表名：生成 `SELECT * FROM <table> LIMIT 100` 并执行

## 前端 — 通用组件库

- [ ] LButton：primary/secondary/danger/ghost 变体，loading 状态，size 属性均正常
- [ ] LInput：prefix/suffix icon、clearable、password 模式、v-model 正常
- [ ] LModal：标题、内容、确认/取消、Esc 关闭 正常
- [ ] LSplitPane：水平/垂直拖拽分割，slot 内容正确渲染
- [ ] LSelect：下拉选择、搜索过滤、多选 正常
- [ ] LContextMenu：右键弹出、嵌套子菜单、分隔线 正常
- [ ] LTooltip：悬停提示、上下左右位置 正常
- [ ] LIcon：SVG 图标正常渲染
- [ ] 所有组件亮色/暗色主题自适应

## 全局验收

- [ ] `cargo clippy` 零警告
- [ ] `cargo test` 全部通过（含集成测试）
- [ ] `pnpm lint`（ESLint + Prettier）零错误
- [x] `vue-tsc --noEmit` 零类型错误
- [ ] `cargo build --release` 成功
- [x] `pnpm build` 成功
- [ ] M0 已有功能无回归（SQLite 连接/查询/元数据正常）
