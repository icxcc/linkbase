# 双击连接调用 API 问题修复方案

## 问题分析

用户反馈双击连接节点仍然会调用 `save_folders_cmd` 和 `save_connections_cmd`。

### 问题根源

**核心问题**：`connectionStore.updateConnection` 每次被调用都会触发 `saveToBackend`，但实际上只有在用户**新增或编辑连接配置**时才应该保存，连接状态的变化（如连接成功、断开等）不应该触发保存操作。

当前流程的问题：

```
连接成功后
    │
    ▼
connectionStore.updateConnection(connId, { id: backendId, status: 'connected' })
    │
    ▼
saveToBackend() ← 不应该调用！
```

### 问题定位

在 `handleConnect` 函数中：
```typescript
const backendId = await connectApi(config)
connectionStore.updateConnection(connId, { id: backendId, status: 'connected' })  // 这里会触发保存
```

连接成功后更新 `id` 和 `status` 是运行时状态变化，不应该持久化到后端存储。

## 修复方案

### 修复1：分离状态更新和配置更新

将 `updateConnection` 拆分为两个方法：
- `updateConnectionStatus` - 只更新状态，不保存
- `updateConnectionConfig` - 更新配置，会保存（新增/编辑时使用）

### 修复2：连接成功后只更新状态

在 `handleConnect` 中，连接成功后只调用状态更新方法，不调用完整的更新方法。

### 修复3：添加新方法更新连接 ID

添加专门的方法来更新连接的后端 ID，不触发保存。

## 修改文件

1. `packages/core/src/stores/connection.ts`
   - 添加 `updateConnectionBackendId` 方法，只更新后端 ID 不保存
   - 修改 `updateConnection`，只在配置变更时保存

2. `packages/connection/src/components/ConnectionTree.vue`
   - 修改 `handleConnect`，连接成功后不调用 `updateConnection`

## 代码变更

### 1. 修改 connection.ts

```typescript
// 新增方法：更新后端连接 ID，不触发保存
function updateConnectionBackendId(id: string, backendId: string) {
  const conn = connections.value.find((c) => c.id === id)
  if (conn) conn.id = backendId
}

// 修改 updateConnection，只更新配置相关字段，不包含状态
function updateConnection(id: string, updates: Partial<Connection>) {
  const conn = connections.value.find((c) => c.id === id)
  if (!conn) return
  
  // 过滤掉状态字段，状态变化不保存
  const configUpdates: Partial<Connection> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'status') {
      configUpdates[key as keyof Connection] = value
    }
  }
  
  if (Object.keys(configUpdates).length === 0) return
  
  Object.assign(conn, configUpdates)
  saveToBackend(connections.value, folders.value)
}
```

### 2. 修改 ConnectionTree.vue

```typescript
async function handleConnect(connId: string) {
  const c = connectionStore.connections.find((x) => x.id === connId)
  if (!c) return

  if (c.status === 'connected' || c.status === 'connecting') {
    if (c.status === 'connected' && !expandedKeys.value.includes(`conn/${connId}`)) {
      expandedKeys.value = [...expandedKeys.value, `conn/${connId}`]
    }
    return
  }

  connectionStore.updateConnectionStatus(connId, 'connecting')
  try {
    const config = {
      driver_type: c.driver_type,
      host: c.host,
      port: c.port,
      user: c.user || c.username,
      password: c.password || (c.options?.password as string | undefined),
      database: c.database,
      connection_string: c.connection_string,
      options: c.options || {},
    }
    const backendId = await connectApi(config)
    // 只更新状态和后端 ID，不触发保存
    connectionStore.updateConnectionBackendId(connId, backendId)
    connectionStore.updateConnectionStatus(backendId, 'connected')
    connectionStore.setCurrentConnection(backendId)
  } catch (err) {
    connectionStore.updateConnectionStatus(connId, 'error')
    console.error('Connection failed:', err)
  }
}
```

## 测试验证

1. 双击已连接的节点，不应调用 `save_folders_cmd` 和 `save_connections_cmd`
2. 双击未连接的节点，连接成功后不应调用保存接口
3. 新增连接时应正常保存
4. 编辑连接配置时应正常保存
5. 删除连接时应正常保存