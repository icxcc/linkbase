# Connection Tree 交互优化计划

## 需求分析

用户要求优化连接树（ConnectionTree）的交互体验：

1. **展开与双击操作统一**：展开连接节点和双击连接节点的行为一致
2. **未连接状态**：先连接数据库，连接成功后自动展开一级节点
3. **已连接状态**：直接展开节点，无需重复连接
4. **元类型节点懒加载**：展开表、视图等元类型节点时才查询对应的数据

## 当前代码分析

### 1. ConnectionTree 组件
路径：`packages/connection/src/components/ConnectionTree.vue`

当前问题：
- 双击和展开操作可能不一致
- 缺少连接状态检查
- 元数据可能一次性加载全部

### 2. 状态管理
路径：`packages/core/src/stores/connection.ts`

需要检查连接状态管理逻辑。

### 3. API 层
路径：`packages/core/src/api/index.ts`

`getMetadata()` 和 `getEnhancedMetadata()` 用于获取元数据。

## 修改方案

### 1. 修改 ConnectionTree.vue
- 统一 `handleExpand` 和 `handleDoubleClick` 处理逻辑
- 在展开/双击连接节点时检查连接状态
- 实现未连接时先连接再展开
- 实现元类型节点懒加载

### 2. 修改 connection.ts store
- 添加连接状态检查方法
- 添加元数据缓存机制

### 3. 可能需要修改的其他文件
- 可能需要添加新的 API 方法用于获取特定类型的元数据

## 步骤分解

1. **分析现有代码**：读取 ConnectionTree.vue 和相关文件
2. **修改事件处理**：统一展开和双击处理逻辑
3. **添加连接检查**：在操作前检查连接状态
4. **实现懒加载**：展开元类型节点时才查询数据
5. **测试验证**：确保交互逻辑正确

## 风险评估

- **低风险**：主要是前端交互逻辑修改，不涉及核心业务逻辑
- **注意事项**：需要确保连接失败时有良好的错误提示

## 文件清单

- `packages/connection/src/components/ConnectionTree.vue` - 主要修改
- `packages/core/src/stores/connection.ts` - 可能需要添加状态检查
- `packages/core/src/api/index.ts` - 可能需要添加懒加载 API