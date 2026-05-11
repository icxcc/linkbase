# Connection ID 设计问题修复方案

## 问题分析

### 当前设计缺陷

当前系统中存在三个相关的标识符概念，导致状态管理混乱：

1. **connectionId** - 前端配置的连接ID（用户创建时生成）
2. **connId** - connectionId 的简写变量名
3. **backendId** - 后端连接实例ID（connect API 返回）

**核心问题**：`connect()` API 返回新的后端ID，然后通过 `updateConnectionBackendId()` 将前端配置的 `id` 替换为后端ID。

```typescript
// 问题代码
function updateConnectionBackendId(id: string, backendId: string) {
  const conn = connections.value.find((c) => c.id === id)
  if (conn) conn.id = backendId  // ❌ 直接替换导致状态追踪混乱
}
```

### 问题影响

1. 配置存储与实际连接状态不同步
2. 断开连接后状态更新可能失败
3. 连接树中状态更新使用的ID与后端不匹配

## 优化方案

### 设计原则

- **前端配置ID不变**：连接配置的 `id` 字段在整个生命周期内保持不变
- **后端使用配置ID绑定**：后端使用前端传入的配置ID作为连接实例的标识
- **连接成功返回状态**：`connect()` API 返回连接状态而非新ID

### 具体修改

#### 1. 修改 API 层

**文件**: `packages/core/src/api/index.ts`

- 修改 `connect()` 函数，使其接受配置ID并返回状态而非新ID
- 后端使用传入的配置ID进行连接管理

#### 2. 修改 Store 层

**文件**: `packages/core/src/stores/connection.ts`

- 删除 `updateConnectionBackendId` 函数（或保留但不执行替换操作）
- 确保所有状态更新使用前端配置ID

#### 3. 修改连接组件

**文件**: `packages/connection/src/components/ConnectionDialog.vue`

- 移除使用 `backendId` 更新状态的逻辑
- 直接使用配置ID进行状态管理

#### 4. 修改连接树 composable

**文件**: `packages/connection/src/composables/useConnectionTree.ts`

- 确保所有连接操作使用前端配置ID

## 风险评估

- **低风险**：主要修改集中在状态管理层
- **需要测试**：连接、断开连接、状态更新等场景

## 修改步骤

1. 修改 `connect()` API 返回类型和实现
2. 删除或修改 `updateConnectionBackendId()` 函数
3. 更新 `ConnectionDialog.vue` 中的连接逻辑
4. 验证连接树的状态管理
