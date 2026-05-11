# ConnectionTree 模块优化方案

## 问题分析

### 问题1：展开未连接节点没有调用接口
- `handleConnect` 函数中连接成功后使用 `backendId` 更新状态，与前端的 `connId` 不一致
- `handleConnectionExpand` 函数可能没有正确触发连接流程

### 问题2：加载元数据时没有loading状态
- 虽然添加了 loading 节点，但可能没有正确显示或更新

## 优化方案

### 1. 统一连接状态管理
- 始终使用前端的 `connId` 进行状态管理
- 连接成功后正确更新状态并触发元数据加载

### 2. 完善 loading 状态
- 在连接过程中显示 connecting 状态
- 在加载元数据时显示 loading 节点

### 3. 代码结构优化
- 提取连接相关逻辑到独立函数
- 添加错误处理和状态回滚

## 修改内容

### 文件：`packages/connection/src/components/ConnectionTree.vue`

1. **修复 `handleConnect` 函数**
   - 使用 `connId` 而非 `backendId` 更新状态

2. **修复 `handleConnectionExpand` 函数**
   - 确保正确调用连接API
   - 添加更好的错误处理

3. **优化 `loadConnectionChildren` 函数**
   - 确保 loading 节点正确显示

4. **添加连接状态追踪**
   - 防止重复连接请求

## 风险评估
- 低风险：主要是前端交互逻辑修改
- 需要测试连接成功和失败的各种场景