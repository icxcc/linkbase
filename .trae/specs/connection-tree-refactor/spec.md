# ConnectionTree 组件重构方案

## Overview

### 问题分析

当前 `ConnectionTree.vue` 组件存在以下问题：

1. **代码组织结构混乱**：函数分散，没有清晰的分组，难以维护
2. **职责过重**：单个组件承担了树渲染、连接管理、元数据加载、上下文菜单等多个职责
3. **重复代码**：`loadConnectionChildren` 和 `refreshConnection` 存在大量重复逻辑
4. **类型定义分散**：类型定义和业务逻辑混在一起
5. **状态管理不清晰**：组件内部状态过多，难以追踪和测试
6. **错误处理不完善**：缺少统一的错误处理机制
7. **可测试性差**：函数相互依赖紧密，难以单独测试

### 重构目标

1. **模块化拆分**：将组件拆分为多个职责单一的模块
2. **清晰的架构分层**：UI层、业务逻辑层、状态管理层分离
3. **可测试性**：核心逻辑可独立测试
4. **可维护性**：代码结构清晰，易于理解和修改
5. **符合项目规范**：遵循 LinkBase 编码规范

---

## Goals

- 将 ConnectionTree 组件重构为模块化、可维护的代码结构
- 提取核心业务逻辑到 composable
- 统一类型定义
- 添加完善的错误处理
- 提高代码可测试性

## Non-Goals (Out of Scope)

- 不改变现有功能和交互行为
- 不修改后端 API
- 不改变 UI 外观样式

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    ConnectionTree.vue (UI层)                │
│  - 树渲染                                                    │
│  - 事件监听                                                  │
│  - 上下文菜单渲染                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              useConnectionTree.ts (业务逻辑层)               │
│  - 连接状态管理                                              │
│  - 元数据加载逻辑                                            │
│  - 节点展开/收起逻辑                                         │
│  - 上下文菜单逻辑                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                connectionStore (状态管理层)                  │
│  - 连接列表状态                                              │
│  - 当前连接状态                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API层 (core/api)                         │
│  - connect, disconnect, getEnhancedMetadata                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 功能模块划分

| 模块 | 职责 | 状态 |
|------|------|------|
| TreeRenderer | 树节点渲染、图标显示 | 纯函数 |
| ConnectionManager | 连接状态管理、连接/断开操作 | Composable |
| MetadataLoader | 元数据加载、缓存管理 | Composable |
| ContextMenuHandler | 上下文菜单逻辑 | Composable |
| TreeNodeBuilder | 节点数据构建 | 纯函数 |

---

## 类型定义规划

### 统一类型文件

创建 `packages/connection/src/types/tree.ts`：

```typescript
export type TreeNodeType = 
  | 'folder' 
  | 'connection' 
  | 'rootContainer' 
  | 'database' 
  | 'schema' 
  | 'category' 
  | 'table' 
  | 'view' 
  | 'materializedView' 
  | 'function' 
  | 'procedure' 
  | 'sequence' 
  | 'index' 
  | 'user' 
  | 'column' 
  | 'trigger' 
  | 'event' 
  | 'role' 
  | 'tablespace'

export interface TreeNodeData {
  nodeType: TreeNodeType
  connectionId?: string
  driverType?: string
  databaseName?: string
  schemaName?: string
  tableName?: string
  columnName?: string
  categoryKey?: string
}

export interface TreeOptionWithMeta extends TreeOption {
  __treeNodeData__?: TreeNodeData
}

export interface ConnectionTreeNode {
  connId: string
  expanded: boolean
  loading: boolean
  children?: TreeOptionWithMeta[]
}
```

---

## 重构步骤

### Step 1: 提取类型定义

- 创建 `packages/connection/src/types/tree.ts`
- 将所有类型定义迁移到新文件

### Step 2: 提取纯函数工具

- 创建 `packages/connection/src/utils/treeUtils.ts`
- 提取 `setNodeData`, `getNodeData`, `getStatusColor`, `buildConnectionNode`, `buildCategoryChildren`

### Step 3: 创建 Composable

- 创建 `packages/connection/src/composables/useConnectionTree.ts`
- 封装连接状态管理、元数据加载、事件处理逻辑

### Step 4: 重构主组件

- 更新 `ConnectionTree.vue`
- 移除业务逻辑，保留 UI 渲染和事件绑定

---

## 代码规范遵循

1. **Vue 规范**：使用 Composition API，`<script setup>`
2. **类型规范**：禁止 `any`，使用明确类型定义
3. **组件职责**：单组件不超过 500 行，只负责 UI 渲染
4. **状态管理**：复杂逻辑提取到 composable
5. **错误处理**：统一错误处理机制

---

## 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 重构引入 Bug | 高 | 保留原有测试，添加新测试 |
| 类型不兼容 | 中 | 严格类型检查 |
| 性能影响 | 低 | 保持原有逻辑，仅重构结构 |

---

## 验收标准

### AC-1: 代码结构清晰
- **Given**: 开发者查看代码
- **When**: 浏览 ConnectionTree 相关文件
- **Then**: 能够清晰理解代码组织结构
- **Verification**: human-judgment

### AC-2: 功能保持不变
- **Given**: 重构完成后
- **When**: 执行连接、展开、查询等操作
- **Then**: 所有功能正常工作
- **Verification**: programmatic

### AC-3: 代码行数减少
- **Given**: 重构前后对比
- **When**: 统计 ConnectionTree.vue 行数
- **Then**: 组件代码行数减少至少 30%
- **Verification**: programmatic

### AC-4: 可测试性提升
- **Given**: 重构完成后
- **When**: 编写单元测试
- **Then**: 核心逻辑可独立测试
- **Verification**: human-judgment

---

## Open Questions

- 是否需要保留现有的测试文件结构？
- 是否需要添加新的测试用例？