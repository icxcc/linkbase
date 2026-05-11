# Connection ID 后端修复方案

## 问题分析

### 当前问题

错误信息：`"Not found: 连接 891060b5-1a33-4353-9a94-5fbff3c3bf61"`

**根本原因**：后端 `connect` 函数生成了新的 UUID 作为连接ID，而不是使用前端传入的配置ID：

```rust
pub async fn connect(&self, config: ConnectionConfig) -> Result<String, AppError> {
    // ... 创建 driver ...
    let id = uuid::Uuid::new_v4().to_string();  // ❌ 生成新UUID
    self.connections.insert(id.clone(), Arc::new(Mutex::new(driver)));
    Ok(id)
}
```

### 影响

1. `getEnhancedMetadata` 使用前端配置ID调用，但后端存储使用的是新生成的UUID
2. 导致"连接未找到"错误

## 修复方案

### 设计原则

- **统一ID**：后端使用前端传入的配置ID作为连接标识
- **配置ID不变**：前端配置ID贯穿整个连接生命周期
- **接口分离**：测试连接和连接接口分开
- **统一参数**：连接接口只接受配置ID，不接受配置对象

### 具体修改

#### 1. 修改后端 connect 函数

**文件**: `apps/desktop/src-tauri/crates/core/src/lib.rs`

- 修改 `connect` 函数，接受配置ID参数
- 使用前端传入的配置ID作为存储键

#### 2. 修改前端 connect API

**文件**: `packages/core/src/api/index.ts`

- 修改 `connect` 函数，只接受配置ID参数
- 移除接受配置对象的能力

#### 3. 修改前端 ConnectionDialog

**文件**: `packages/connection/src/components/ConnectionDialog.vue`

- 确保添加连接时先保存配置，然后使用配置ID连接

#### 4. 修改前端 useConnectionTree

**文件**: `packages/connection/src/composables/useConnectionTree.ts`

- 确保连接时传入正确的配置ID

## 修改步骤

1. 修改后端 `connect` 函数签名，使用配置ID参数
2. 修改前端 API `connect` 函数，只接受配置ID
3. 更新 ConnectionDialog 组件的连接逻辑
4. 验证连接树的状态管理
5. 测试连接和元数据获取流程

## 风险评估

- **低风险**：修改集中在连接建立阶段
- **需要测试**：连接、获取元数据、断开连接等场景
