# 安全连接配置存储 - 实现计划

## [x] Task 1: 后端创建连接配置存储模块
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 创建 `connection_storage.rs` 模块
  - 实现文件读写功能
  - 实现 AES-256 加密/解密功能
- **Acceptance Criteria Addressed**: FR-1, FR-2
- **Test Requirements**:
  - `programmatic` TR-1.1: 连接配置能正确保存到本地文件
  - `programmatic` TR-1.2: 密码字段应加密存储
  - `programmatic` TR-1.3: 加载时密码能正确解密

## [x] Task 2: 后端添加 Tauri 命令
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 添加 `save_connections` 命令
  - 添加 `load_connections` 命令
  - 添加 `save_folders` 命令
  - 添加 `load_folders` 命令
- **Acceptance Criteria Addressed**: FR-1, FR-3, FR-4
- **Test Requirements**:
  - `programmatic` TR-2.1: 前端能调用命令保存连接
  - `programmatic` TR-2.2: 前端能调用命令加载连接

## [x] Task 3: 前端 API 封装
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 在 `api/index.ts` 中添加保存和加载连接的函数
  - 添加保存和加载文件夹的函数
- **Acceptance Criteria Addressed**: FR-3, FR-4
- **Test Requirements**:
  - `programmatic` TR-3.1: 前端 API 能正确调用后端命令

## [x] Task 4: 修改前端 store 使用后端存储
- **Priority**: P0
- **Depends On**: Task 3
- **Description**: 
  - 修改 `connection.ts` 从后端加载配置
  - 修改操作函数调用后端保存
  - 移除 localStorage 存储逻辑
- **Acceptance Criteria Addressed**: FR-3, FR-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 重启应用后连接配置自动恢复
  - `human-judgment` TR-4.2: 连接配置变更能正确保存

## [x] Task 5: 数据迁移
- **Priority**: P1
- **Depends On**: Task 3, Task 4
- **Description**: 
  - 实现从 localStorage 迁移到文件存储的逻辑
  - 添加迁移检测和执行逻辑
- **Acceptance Criteria Addressed**: NFR-3
- **Test Requirements**:
  - `human-judgment` TR-5.1: 已有 localStorage 数据能自动迁移

## Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 3, Task 4
