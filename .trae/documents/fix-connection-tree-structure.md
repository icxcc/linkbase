# 修复 ConnectionTree 组件展示结构

## 问题分析

### Bug 1：缺少根级容器节点

Spec 要求（spec.md:48-51）的树结构为：
```
[连接]
  └── [数据库 / 模式 / 用户等根级容器]（根据数据库类型不同）
        └── [数据库1]
              └── [表] ── [表1, 表2, ...]
              └── [视图] ── [视图1, ...]
```

当前代码对于 `rootContainerType === 'databases'`（MySQL）和 `rootContainerType === 'schemas'`（PostgreSQL/Oracle），数据库/模式节点直接挂在连接节点下，**缺少** `rootContainerLabel`（如 "Databases"、"Schemas"）中间容器节点。

`TreeNodeTemplate` 已有 `rootContainerLabel` 字段（"Databases"、"Schemas"），但 `loadConnectionChildren` 和 `refreshConnection` **从未**将其创建为树节点。

### Bug 2：分类节点的懒加载完全失效

`onExpandedKeysChange`（line 639）中判断分类节点展开的条件为：
```typescript
parts.length === 4 && parts[2] === 'cat'
```

但实际 key 结构是：
- `databases` 情况：`conn/${connId}/db/${dbName}/cat/${categoryKey}` → 去掉 `conn/` 后 5 段，不匹配
- `schemas` 情况：`conn/${connId}/schema/${schemaName}/cat/${categoryKey}` → 5 段，不匹配
- `flat` 情况：`conn/${connId}/cat/${categoryKey}` → 3 段，不匹配

**三种情况全部不匹配**，导致展开 Tables/Views/Functions 等分类节点时从不触发 `loadCategoryChildren`，分类子节点始终为空。

---

## 修复方案

### 修改文件

`packages/connection/src/components/ConnectionTree.vue`

### Step 1：新增 `rootContainer` 节点类型

**位置**：`TreeNodeType` 联合类型（line 125）

```typescript
type TreeNodeType = 'folder' | 'connection' | 'rootContainer' | 'category' | 'table' | 'view' | 'materializedView' | 'function' | 'procedure' | 'sequence' | 'index' | 'user' | 'column'
```

### Step 2：修复 `loadConnectionChildren` — 添加容器节点

**位置**：lines 392-472

**目标结构（MySQL `databases`）**：
```
Connection (conn/id1)
  └── Databases (conn/id1/container)           ← 新增容器节点
        └── mydb (conn/id1/container/db/mydb)  ← key 变更
              └── Tables (conn/id1/container/db/mydb/cat/tables)
              └── Views
              └── Functions
```

**目标结构（PostgreSQL `schemas`）**：
```
Connection (conn/id1)
  └── Schemas (conn/id1/container)              ← 新增容器节点
        └── public (conn/id1/container/schema/public)
              └── Tables
              └── Views
```

**目标结构（SQLite `flat`）**：不变，分类节点直接挂在连接下。

修改 `databases` 分支：
- 创建 `containerNode`（key: `conn/${connId}/container`，label: `template.rootContainerLabel`，nodeType: `'rootContainer'`）
- 各 db 节点的 key 前缀从 `conn/${connId}/db/` 改为 `conn/${connId}/container/db/`
- db 节点作为 `containerNode.children` 的子级，`containerNode` 加入 `children` 数组

修改 `schemas` 分支：
- 同上，创建 containerNode
- schema 节点的 key 前缀从 `conn/${connId}/schema/` 改为 `conn/${connId}/container/schema/`

`flat` 分支：不变。

### Step 3：修复 `refreshConnection` — 同步添加容器节点

**位置**：lines 520-602

与 Step 2 完全相同的修改。

### Step 4：修复 `onExpandedKeysChange` — 修正 key 解析

**位置**：lines 625-643

改用 `indexOf('cat')` 解析分类节点 key：
```typescript
for (const key of newKeys) {
  if (key.startsWith('conn/')) {
    const parts = key.replace('conn/', '').split('/')
    const connId = parts[0]
    
    if (parts.length === 1) {
      // 连接节点展开 → 加载子级
      loadConnectionChildren(connId)
    } else {
      const catIndex = parts.indexOf('cat')
      if (catIndex !== -1 && catIndex + 1 < parts.length) {
        const categoryKey = parts[catIndex + 1]
        // flat:          [connId, cat, categoryKey]          → catIndex=1, containerName=undefined
        // db container:  [connId, container, db, dbname, cat, categoryKey]    → catIndex=4, containerName=parts[3]
        // schema container: [connId, container, schema, schName, cat, categoryKey] → catIndex=4, containerName=parts[3]
        const containerName = catIndex > 1 ? parts[catIndex - 1] : undefined
        loadCategoryChildren(connId, containerName, categoryKey)
      }
    }
  }
}
```

### Step 5：修复 `loadCategoryChildren` — 更新 keyPrefix 及 containerName 可选

**位置**：lines 646-681

- `containerName` 参数改为 `containerName?: string`
- keyPrefix 根据 `rootContainerType` 区分：
  - `flat`：`conn/${connId}/cat/${categoryKey}`
  - `databases`：`conn/${connId}/container/db/${containerName}/cat/${categoryKey}`
  - `schemas`：`conn/${connId}/container/schema/${containerName}/cat/${categoryKey}`

- 当 `containerName` 为 `undefined` 时（flat 情况），不查找 db/schema，传入空对象。

### Step 6：验证

运行 `cd apps/desktop && npx vue-tsc --noEmit` 确认无类型错误。
