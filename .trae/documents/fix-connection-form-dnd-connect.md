# 修复连接功能四个Bug

## 问题分析

### Bug 1：双击已有连接无法连接到数据库（密码问题）

两个问题叠加：
1. [ConnectionTree.vue:L870-L885](file:///e:/WebstormProjects/linkbase/linkbase/packages/connection/src/components/ConnectionTree.vue#L870-L885) `onNodeDblClick` 只处理了 `table`、`view`、`materializedView` 三种节点类型，**没有处理 `connection` 类型**，双击连接节点什么都不触发。

2. [ConnectionTree.vue:L896-L906](file:///e:/WebstormProjects/linkbase/linkbase/packages/connection/src/components/ConnectionTree.vue#L896-L906) `handleConnect` 中密码字段读取：
```typescript
password: c.options?.password as string | undefined,
```
从 `c.options?.password` 读取密码。但在 store 加载逻辑中（[connection.ts:L76-L80](file:///e:/WebstormProjects/linkbase/linkbase/packages/core/src/stores/connection.ts#L76-L80)）：
```typescript
connections.value = storedConns.map((c) => ({
  ...c,
  folderId: c.folder_id,
  status: 'idle',
}))
```
`password` 是通过 `...c`（StoredConnection）展开到 `Connection` 对象上的，即密码存储在 `c.password`。

同理 `handleTestConnection`（line 929-942）也有相同问题。

### Bug 2：连接无法拖拽到分组中（参数名彻底错误）

通过查看 naive-ui 源码确认实际 API 签名：

**`AllowDrop` 类型**（[interface.d.ts:L52-L56](file:///e:/WebstormProjects/linkbase/linkbase/packages/connection/node_modules/naive-ui/es/tree/src/interface.d.ts#L52-L56)）：
```typescript
export type AllowDrop = (info: {
    dropPosition: DropPosition;
    node: TreeOption;    // ← TARGET 节点，而非拖拽节点！
    phase: 'drag' | 'drop';
}) => boolean;
```

**`TreeDropInfo` 接口**（用于 `@drop` 事件，[interface.d.ts:L41-L46](file:///e:/WebstormProjects/linkbase/linkbase/packages/connection/node_modules/naive-ui/es/tree/src/interface.d.ts#L41-L46)）：
```typescript
export interface TreeDropInfo {
    event: DragEvent;
    node: TreeOption;      // ← TARGET 节点
    dragNode: TreeOption;  // ← 被拖拽的节点
    dropPosition: 'before' | 'inside' | 'after';
}
```

当前代码 `allowDrop` 解构 `{ node, dropPosition, dropNode }` 有 **三个错误**：
1. `node` 是目标节点（不是拖拽节点），但代码当成拖拽节点用
2. `dropNode` 不存在于 `AllowDrop` 签名中，始终为 `undefined`
3. 缺少 `phase` 参数

当前代码 `onDrop` 解构 `{ node, dropPosition, dropNode }` 有 **两个错误**：
1. `node` 是目标节点，`dragNode` 才是被拖拽的节点
2. `dropNode` 不存在，正确的参数名是 `dragNode`

结果：当拖拽连接节点到分组时，`getNodeData(node)` 拿到的是**分组**的 nodeData（`{ nodeType: 'folder' }`），所以 `dragData.nodeType === 'connection'` 永远不会匹配，drop 无操作。

### Bug 3：编辑连接没展示/数据不完整

[ConnectionDialog.vue:L142-L156](file:///e:/WebstormProjects/linkbase/linkbase/packages/connection/src/components/ConnectionDialog.vue#L142-L156) 的 `loadConnection()` 没有回填密码字段：
```typescript
formModel.name = conn.name
if (conn.host) formModel.host = conn.host
if (conn.port) formModel.port = conn.port
if (conn.user) formModel.user = conn.user
if (conn.username) formModel.user = conn.username
if (conn.database) formModel.database = conn.database
// 缺少: if (conn.password) formModel.password = conn.password
if (conn.connection_string) formModel.filePath = conn.connection_string
// 缺少: if (conn.folderId) formModel.folderId = conn.folderId
```

### Bug 4：创建/编辑连接表单缺少分组选项

`ConnectionDialog.vue` 的表单字段由 `DRIVER_CONFIGS[selectedDriver].fields` 驱动（每个驱动类型的字段列表固定），其中没有 `folderId` 字段。需要为所有驱动类型统一添加分组选择器。

---

## 修复方案

### 修改文件

1. `packages/connection/src/components/ConnectionTree.vue`
2. `packages/connection/src/components/ConnectionDialog.vue`

---

### Step 1: 修复双击连接 → 触发连接

**文件**: `ConnectionTree.vue`

在 `onNodeDblClick` 中增加 `connection` 节点类型的处理：
```typescript
function onNodeDblClick(_e: MouseEvent, node: TreeOption) {
  const nodeData = getNodeData(node)
  if (!nodeData) return

  if (nodeData.nodeType === 'connection') {
    if (nodeData.connectionId) handleConnect(nodeData.connectionId)
  } else if (nodeData.nodeType === 'table') {
    ...
```

### Step 2: 修复密码读取 + 测试连接

**文件**: `ConnectionTree.vue`

修改 `handleConnect`（line 896）和 `handleTestConnection`（line 930）：
```typescript
// 修改前
password: c.options?.password as string | undefined,

// 修改后
password: c.password,
```

### Step 3: 修复拖拽到分组的参数名

**文件**: `ConnectionTree.vue`

根据 naive-ui 实际 API 修正两个函数的参数解构：

`allowDrop` — 修正为幼稚-ui的真实签名：
```typescript
function allowDrop({ node, dropPosition }: { node: TreeOption; dropPosition: 'before' | 'inside' | 'after'; phase: 'drag' | 'drop' }) {
  const targetData = getNodeData(node)

  if (targetData?.nodeType === 'folder' && dropPosition === 'inside') return true
  if ((targetData?.nodeType === 'connection' || targetData?.nodeType === 'folder') && dropPosition !== 'inside') return true
  return false
}
```
注：`AllowDrop` 不提供 `dragNode`，只能根据目标节点和位置判断。如果需要限制不允许某些节点被拖拽，需在 `onDrop` 中二次校验。

`onDrop` — 使用正确的参数名 `dragNode`：
```typescript
function onDrop({ node: dropNode, dragNode, dropPosition }: { node: TreeOption; dragNode: TreeOption; dropPosition: 'before' | 'inside' | 'after'; event: DragEvent }) {
  const dragData = getNodeData(dragNode)
  const dropData = getNodeData(dropNode)

  if (!dragData) return

  if (dragData.nodeType === 'connection') {
    const connId = dragData.connectionId
    if (!connId) return

    if (dropData?.nodeType === 'folder' && dropPosition === 'inside') {
      const folderId = String(dropNode.key).replace('folder/', '')
      connectionStore.moveToFolder(connId, folderId)
      refreshTreeData()
    }
  }
}
```

在 `onDrop` 末尾加 `refreshTreeData()` 确保树即时刷新（因为 `$subscribe` 可能对数组元素内字段变更不触发）。

### Step 4: 修复编辑连接密码回填

**文件**: `ConnectionDialog.vue`

在 `loadConnection()` 函数中补充：
```typescript
if (conn.password) formModel.password = conn.password
if (conn.options?.password) formModel.password = conn.options.password as string
if (conn.folderId) formModel.folderId = conn.folderId
```

### Step 5: 添加分组选择字段到连接表单

**文件**: `ConnectionDialog.vue`

1. 在表单顶部（n-form 内部，`v-for` 循环前）添加分组选择行：
```html
<n-form-item :label="$t('connection.folder')">
  <n-select
    :value="folderIdModel"
    @update:value="(v: string) => folderIdModel = v"
    :options="folderOptions"
    :placeholder="$t('connection.noFolder')"
    clearable
  />
</n-form-item>
```

2. 在 `<script setup>` 中添加：
```typescript
const folderIdModel = ref<string | undefined>(undefined)

const folderOptions = computed(() => {
  const options: { label: string; value: string }[] = []
  for (const f of connectionStore.folders) {
    options.push({ label: f.name, value: f.id })
  }
  return options
})
```

3. 在 `loadConnection()` 中回填分组：
```typescript
folderIdModel.value = conn.folderId
```

4. 在 `handleSave()` 中将 `folderIdModel` 存入 connection：
在 `updateConnection` 和 `addConnection` 的字段中添加 `folderId: folderIdModel.value || undefined`。

5. 初始化时（`watch visible` 新建模式），重置 `folderIdModel.value = undefined`。

---

### Step 6: 验证

运行 `cd apps/desktop && npx vue-tsc --noEmit` 确认无类型错误。
