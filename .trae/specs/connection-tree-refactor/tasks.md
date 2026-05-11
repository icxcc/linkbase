# ConnectionTree 模块优化 - 实现计划

## \[ ] Task 1: 修复 handleConnect 函数

* **Priority**: P0

* **Depends On**: None

* **Description**:

  * 确保始终使用前端的 `connId` 进行状态管理

  * 连接成功后正确更新状态

* **Acceptance Criteria Addressed**: AC-4, AC-5

* **Test Requirements**:

  * `programmatic` TR-1.1: 验证 connecting 状态正确阻止重复请求

  * `human-judgement` TR-1.2: 连接失败时状态回滚到 disconnected

* **Notes**: 当前代码已使用 connId，但需要确保状态更新逻辑正确

## \[ ] Task 2: 修复 handleConnectionExpand 函数

* **Priority**: P0

* **Depends On**: Task 1

* **Description**:

  * 确保在展开未连接节点时正确调用连接API

  * 连接成功后触发元数据加载

* **Acceptance Criteria Addressed**: AC-1, AC-2

* **Test Requirements**:

  * `human-judgement` TR-2.1: 展开未连接节点时自动触发连接

  * `human-judgement` TR-2.2: 连接成功后自动加载元数据

* **Notes**: 当前代码逻辑基本正确，但需要验证连接成功后的流程

## [ ] Task 3: 优化 loadConnectionChildren 函数
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 使用 n-tree 原生 `isLoading` 属性显示加载状态
  - 移除手动添加 loading 节点的方式
  - 加载完成后正确替换为实际数据
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 连接成功后显示原生 loading 图标
  - `human-judgement` TR-3.2: 加载完成后正确显示数据库结构
- **Notes**: 需要修改代码使用 n-tree 的 isLoading 属性而非手动添加 loading 节点

## \[ ] Task 4: 添加连接状态追踪机制

* **Priority**: P1

* **Depends On**: Task 1

* **Description**:

  * 添加正在进行的连接请求追踪

  * 防止同一连接的重复请求

* **Acceptance Criteria Addressed**: AC-4

* **Test Requirements**:

  * `programmatic` TR-4.1: 同一连接多次快速展开只触发一次连接请求

  * `human-judgement` TR-4.2: 界面没有重复加载状态闪烁

* **Notes**: 可以使用 Set 或 Map 来追踪正在进行的连接

## \[ ] Task 5: 增强错误处理和状态回滚

* **Priority**: P1

* **Depends On**: Task 1, Task 3

* **Description**:

  * 添加详细的错误日志记录

  * 确保错误状态正确回滚

  * 清除 loading 节点并显示错误信息

* **Acceptance Criteria Addressed**: AC-5

* **Test Requirements**:

  * `human-judgement` TR-5.1: 加载失败时清除 loading 节点

  * `human-judgement` TR-5.2: 错误状态正确显示

* **Notes**: 需要确保错误时的用户反馈

## \[ ] Task 6: 代码结构优化和重构

* **Priority**: P2

* **Depends On**: Task 1-5

* **Description**:

  * 提取连接相关逻辑到独立函数

  * 提高代码可读性和可维护性

* **Acceptance Criteria Addressed**: 代码质量

* **Test Requirements**:

  * `human-judgement` TR-6.1: 代码结构清晰，职责分明

  * `human-judgement` TR-6.2: 没有重复代码

* **Notes**: 重构时保持功能不变

