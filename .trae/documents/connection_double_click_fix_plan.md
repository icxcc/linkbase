# 连接双击问题修复方案

## 问题分析

### 问题1：连接已连接时双击节点会重复连接
在 `packages/connection/src/components/ConnectionTree.vue` 的 `handleConnect` 函数中，没有检查连接当前状态。当用户双击一个已连接的节点时，会再次尝试连接，导致重复连接。

### 问题2：双击连接会多次调用 API
1. 双击连接节点调用 `handleConnect` -> `updateConnection` -> `saveToBackend`，触发 `save_folders_cmd` 和 `save_connections_cmd`
2. 双击可能触发节点展开事件，调用 `onExpandedKeysChange` -> `loadConnectionChildren` -> `getEnhancedMetadata`

## 修复方案

### 修复1：添加连接状态检查
在 `handleConnect` 函数中，添加状态检查，当连接已经是 `connected` 或 `connecting` 状态时，直接返回，不执行连接操作。

### 修复2：优化双击处理逻辑
1. 在 `handleNodeDblClick` 中，对于已连接的节点，直接展开节点而不是调用连接
2. 避免不必要的 API 调用

## 修改文件

1. `packages/connection/src/components/ConnectionTree.vue`
   - 修改 `handleConnect` 函数，添加状态检查
   - 修改 `handleNodeDblClick` 函数，优化双击逻辑

## 代码变更

### 1. 修改 handleConnect 函数
```typescript
async function handleConnect(connId: string) {
  const c = connectionStore.connections.find((x) => x.id === connId)
  if (!c) return
  
  // 修复：如果已经连接或正在连接，直接返回
  if (c.status === 'connected' || c.status === 'connecting') {
    // 如果已连接，尝试展开节点
    if (c.status === 'connected' && !expandedKeys.value.includes(`conn/${connId}`)) {
      expandedKeys.value = [...expandedKeys.value, `conn/${connId}`]
    }
    return
  }

  connectionStore.updateConnectionStatus(connId, 'connecting')
  try {
    // ... 原有连接逻辑
  } catch (err) {
    connectionStore.updateConnectionStatus(connId, 'error')
    console.error('Connection failed:', err)
  }
}
```

### 2. 修改 handleNodeDblClick 函数
```typescript
function handleNodeDblClick(node: TreeOption) {
  const nodeData = getNodeData(node)
  if (!nodeData) return

  if (nodeData.nodeType === 'connection') {
    if (nodeData.connectionId) {
      const conn = connectionStore.connections.find(c => c.id === nodeData.connectionId)
      // 如果已连接，直接展开，不触发连接
      if (conn?.status === 'connected') {
        const key = `conn/${nodeData.connectionId}`
        if (!expandedKeys.value.includes(key)) {
          expandedKeys.value = [...expandedKeys.value, key]
        }
        return
      }
      handleConnect(nodeData.connectionId)
    }
  } else if (nodeData.nodeType === 'table') {
    // ... 原有逻辑
  } else if (nodeData.nodeType === 'view' || nodeData.nodeType === 'materializedView') {
    // ... 原有逻辑
  }
}
```

## 测试验证

1. 双击已连接的节点，不应触发重复连接
2. 双击已连接的节点，应展开显示数据库结构
3. 双击未连接的节点，应正常连接
4. 连接成功后，只调用一次 save_folders_cmd、save_connections_cmd、get_enhanced_metadata