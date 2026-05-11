# LinkBase 代码质量整改任务分解

## [x] 任务 1：前端不存储密码，后端统一管理
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改后端 `connect` 命令，支持通过 `connection_id` 连接（从后端存储读取密码）
  - 修改后端 `load_connections`，不返回密码字段
  - 修改前端 `Connection` 类型，移除 `password` 字段
  - 修改前端 `connectApi` 调用，仅传连接 ID
  - 仅在新建/编辑连接的表单中临时持有密码
- **Acceptance Criteria Addressed**: S1
- **Test Requirements**:
  - `programmatic`: 前端 Vue store 和 localStorage 中无密码
  - `programmatic`: 能通过连接 ID 正确连接数据库
  - `human-judgement`: 新建/编辑连接能正常保存密码

## [x] 任务 2：大数据集流式加载实现
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改 Rust 驱动支持流式查询（使用 sqlx 的 fetch 而非 fetch_all）
  - 添加 chunk 传输机制（每次返回 N 行）
  - 前端实现增量加载和虚拟滚动结合
- **Acceptance Criteria Addressed**: P1
- **Test Requirements**:
  - `programmatic`: 10万行结果集内存占用 < 100MB
  - `programmatic`: 流式查询能正确分批返回数据
  - `human-judgement`: 大结果集查询不卡顿

## [x] 任务 3：锁内 IO 问题修复
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 将所有驱动的 `std::sync::Mutex` 替换为 `tokio::sync::Mutex`
  - 重构驱动架构，仅在必要时持有锁
  - 确保异步操作不在锁内执行
- **Acceptance Criteria Addressed**: P2, P4
- **Test Requirements**:
  - `programmatic`: 并发查询能并行执行
  - `human-judgement`: 驱动代码符合异步最佳实践

## [ ] 任务 4：响应式优化（shallowRef）
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 修改 `result.ts` 中 `results` 使用 `shallowRef()`
  - 更新相关组件确保正确处理
- **Acceptance Criteria Addressed**: P3
- **Test Requirements**:
  - `programmatic`: 大结果集渲染性能提升 > 50%
  - `human-judgement`: 组件行为正确无异常

## [x] 任务 5：危险操作确认机制
## [ ] 任务 6：统一错误处理
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 创建错误处理工具函数 `normalizeError`
  - 修改所有 API 调用使用统一错误处理
  - 添加全局错误边界
- **Acceptance Criteria Addressed**: C3
- **Test Requirements**:
  - `programmatic`: 错误能被正确捕获和格式化
  - `human-judgement`: 错误处理代码一致

## [ ] 任务 6：危险操作确认机制
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 创建 SQL 危险操作检测工具
  - 在执行 SQL 前检测并显示确认对话框
  - 替换原生 `confirm/alert` 为 UI 组件
- **Acceptance Criteria Addressed**: S2, C2
- **Test Requirements**:
  - `programmatic`: DROP/TRUNCATE/DELETE 语句触发确认
  - `human-judgement`: 使用统一的 UI 组件

## [ ] 任务 7：日志规范整改
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 创建统一的日志工具
  - 替换所有 `console.error` 调用
- **Acceptance Criteria Addressed**: C1
- **Test Requirements**:
  - `programmatic`: 无直接 console.error 调用
  - `human-judgement`: 日志调用统一

## [ ] 任务 8：驱动能力声明
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 在 db-common 中添加 `DriverCapabilities` 结构
  - 所有驱动实现能力声明
- **Acceptance Criteria Addressed**: C4
- **Test Requirements**:
  - `programmatic`: 所有驱动实现 `get_capabilities` 方法
  - `human-judgement`: 能力声明完整

## [ ] 任务 9：查询超时机制
- **Priority**: P2
- **Depends On**: 任务 3
- **Description**: 
  - 为查询添加超时配置
  - 实现查询超时自动取消
- **Acceptance Criteria Addressed**: C5
- **Test Requirements**:
  - `programmatic`: 查询能在超时时间后自动取消
  - `human-judgement`: 超时配置合理