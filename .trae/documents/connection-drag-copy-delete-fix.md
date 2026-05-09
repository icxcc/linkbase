# 连接拖拽到分组 & 复制/删除功能 修复计划

## 问题1：连接无法拖拽到分组

### 根因分析

`onDrop` 函数（文件：`packages/connection/src/components/ConnectionTree.vue` 第899-915行）依赖 `getNodeData(dragNode)` 获取拖拽节点的自定义属性 `__treeNodeData__`。但 Naive UI 的 `n-tree` 组件在拖拽过程中传递给 `onDrop` 的 `dragNode` 可能不保留原始对象引用上的自定义属性，导致 `getNodeData(dragNode)` 返回 `undefined`，使得函数在第903行提前返回 (`if (!dragData) return`)，拖拽操作被忽略。

### 修复方案

**不依赖自定义属性，改用节点 key 解析连接ID。**

修改 `onDrop` 函数，从 `dragNode.key` 字符串中解析出 `connectionId`（因为 `buildConnectionNode` 中 key 格式为 `conn/${connectionId}`）：

```typescript
// packages/connection/src/components/ConnectionTree.vue 第899-915行
function onDrop(...) {
  // 不再依赖 getNodeData(dragNode)
  const dragKey = String(dragNode.key)
  
  // 从 key 格式判断节点类型
  if (dragKey.startsWith('conn/')) {
    const connId = dragKey.replace('conn/', '')
    if (!connId) return

    // 拖入分组内部
    if (dropData?.nodeType === 'folder' && dropPosition === 'inside') {
      const folderId = String(dropNode.key).replace('folder/', '')
      connectionStore.moveToFolder(connId, folderId)
      refreshTreeData()
    }
    // 连接节点之间的排序（before/after）
    // 暂不实现排序逻辑，但保留 allow-drop 支持后续扩展
  }
}
```

同时更新 `allowDrop` 函数，也需要从 key 解析拖拽源节点类型（虽然 Naive UI 的 `allowDrop` 不传 `dragNode`，但可通过 key 检查和 node 类型的组合判断），确保只允许连接类型节点进行拖拽移动。

### 涉及文件
- `packages/connection/src/components/ConnectionTree.vue` - 修改 `onDrop`、`allowDrop` 函数

---

## 问题2：连接缺少复制/删除功能

### 现状

- **删除功能**：已存在。右键菜单第771行有"删除"（`connDelete`），第995-998行有 `handleDeleteConnection` 函数，功能完整可用。
- **复制（克隆）功能**：不存在。用户需要能快速复制一个已有连接来创建相似配置的新连接。

### 修复方案

#### Step 1：Store 层添加 `cloneConnection` 方法

在 `packages/core/src/stores/connection.ts` 中添加：

```typescript
function cloneConnection(sourceId: string): Connection | null {
  const source = connections.value.find((c) => c.id === sourceId)
  if (!source) return null
  
  const newId = crypto.randomUUID?.() ?? `conn-${Date.now()}`
  const cloned: Connection = {
    ...source,
    id: newId,
    name: `${source.name} - 副本`,
    status: 'idle',
    folderId: source.folderId,
    password: source.password,
  }
  
  connections.value.push(cloned)
  connectionOrder.value.push(newId)
  persistOrder()
  saveToBackend(connections.value, folders.value)
  return cloned
}
```

#### Step 2：ConnectionTree.vue 添加右键菜单项

在连接节点右键菜单（第764-772行）中添加"复制连接"：

```typescript
case 'connection':
  items = [
    { key: 'connConnect', label: '连接', icon: 'Link' },
    { key: 'connDisconnect', label: '断开', icon: 'Unlink' },
    { key: 'connEdit', label: '编辑', icon: 'Edit' },
    { key: 'connRefresh', label: '刷新', icon: 'Refresh' },
    { key: 'connTest', label: '测试连接', icon: 'Pulse' },
    { key: 'connClone', label: '复制连接', icon: 'Copy' },  // 新增
    { key: 'connDelete', label: '删除', icon: 'Trash' },
  ]
  break
```

#### Step 3：添加复制连接的处理逻辑

在 `onContextMenuSelect` 函数中添加 `connClone` 分支：

```typescript
case 'connClone':
  if (nodeData?.connectionId) handleCloneConnection(nodeData.connectionId)
  break
```

并添加 `handleCloneConnection` 函数：

```typescript
function handleCloneConnection(connId: string) {
  const cloned = connectionStore.cloneConnection(connId)
  if (cloned) {
    // 可选的提示
    emit('openEditDialog', cloned.id)
  }
}
```

### 涉及文件
- `packages/core/src/stores/connection.ts` - 添加 `cloneConnection` 方法并导出
- `packages/connection/src/components/ConnectionTree.vue` - 添加右键菜单项和处理逻辑

---

## 验证步骤

1. **拖拽验证**：
   - 创建1个分组和多条连接
   - 将连接拖入分组，验证连接出现在分组内
   - 将连接从分组内拖出到根层级
   - 验证刷新后数据持久化正确

2. **复制验证**：
   - 右键点击连接 → "复制连接"
   - 验证出现带"副本"后缀的新连接
   - 验证新连接配置与源连接一致（host、port、user等）
   - 验证新连接出现在相同的分组中

3. **删除验证**：
   - 右键点击连接 → "删除"
   - 确认后验证连接被移除
   - 验证分组内连接的删除也能正常工作
