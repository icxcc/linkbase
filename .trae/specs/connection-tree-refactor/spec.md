# ConnectionTree 模块优化 - 产品需求文档

## Overview
- **Summary**: 修复 ConnectionTree 组件中展开未连接节点时没有正确调用接口的问题，以及加载元数据时缺少 loading 状态显示的问题
- **Purpose**: 确保连接树节点在展开时能够正确连接数据库并显示加载状态，提升用户体验
- **Target Users**: 使用连接树导航数据库结构的用户

## Goals
- 修复展开未连接节点时正确调用连接接口
- 确保加载元数据时显示 loading 状态
- 防止重复连接请求
- 添加错误处理和状态回滚

## Non-Goals (Out of Scope)
- 修改数据库驱动实现
- 改变连接树的整体结构设计
- 修改其他组件的功能

## Background & Context
根据项目计划文档，当前存在两个主要问题：
1. 展开未连接节点时没有调用接口
2. 加载元数据时没有 loading 状态

当前代码位于 `packages/connection/src/composables/useConnectionTree.ts`，需要对以下函数进行优化：
- `handleConnect`
- `handleConnectionExpand`
- `loadConnectionChildren`

## Functional Requirements
- **FR-1**: 展开未连接的数据库连接节点时，应自动调用连接接口
- **FR-2**: 连接过程中应显示连接状态（connecting）
- **FR-3**: 加载元数据时应使用 n-tree 原生懒加载状态显示 loading 图标
- **FR-4**: 应防止重复的连接请求
- **FR-5**: 连接或加载失败时应正确处理错误并回滚状态

## Non-Functional Requirements
- **NFR-1**: 连接状态更新必须使用前端的 `connId` 而非后端的 `backendId`
- **NFR-2**: 错误处理应记录日志并保持界面响应
- **NFR-3**: 状态回滚应确保界面一致性

## Constraints
- **Technical**: Vue 3 Composition API, TypeScript, Naive UI
- **Dependencies**: @linkbase/core/stores/connection, @linkbase/core/api

## Assumptions
- 连接API (`connectApi`) 已正确实现
- 状态管理 (`connectionStore`) 已正确配置
- 树节点更新机制 (`updateTreeNode`) 正常工作

## Acceptance Criteria

### AC-1: 展开未连接节点触发连接
- **Given**: 用户在连接树中点击展开一个未连接的数据库节点
- **When**: 节点状态为 `disconnected`
- **Then**: 应自动调用连接接口并显示连接状态
- **Verification**: `human-judgment`

### AC-2: 连接过程显示 connecting 状态
- **Given**: 正在进行数据库连接
- **When**: 连接请求已发出但未完成
- **Then**: 节点应显示 connecting 状态图标/样式
- **Verification**: `human-judgment`

### AC-3: 加载元数据显示原生 loading 状态
- **Given**: 连接成功后加载数据库元数据
- **When**: 元数据请求已发出但未完成
- **Then**: 应使用 n-tree 原生 `isLoading` 属性显示 loading 图标
- **Verification**: `human-judgment`

### AC-4: 防止重复连接请求
- **Given**: 用户快速多次点击展开同一节点
- **When**: 节点状态为 `connecting`
- **Then**: 后续的连接请求应被忽略
- **Verification**: `programmatic`

### AC-5: 连接失败正确回滚状态
- **Given**: 数据库连接失败
- **When**: 连接API返回错误
- **Then**: 节点状态应回滚到 `disconnected` 并显示错误状态
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要添加连接超时处理？
- [ ] 是否需要添加重试机制？
