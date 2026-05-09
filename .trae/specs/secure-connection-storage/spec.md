# 安全连接配置存储 - Product Requirement Document

## Overview
- **Summary**: 将数据库连接配置从 localStorage 迁移到后端安全文件存储，使用加密方式存储敏感信息（如密码）。
- **Purpose**: 提高连接配置的安全性，避免敏感信息泄露，同时提供跨浏览器的数据持久化。
- **Target Users**: 所有使用数据库连接功能的用户

## Goals
- [ ] 连接配置存储到后端本地文件（JSON 格式）
- [ ] 敏感信息（密码）使用加密存储
- [ ] 前端通过 Tauri API 与后端存储交互
- [ ] 保持现有 API 接口不变，实现无缝迁移

## Non-Goals (Out of Scope)
- [ ] 不涉及云端同步
- [ ] 不涉及用户账户系统

## Background & Context
当前使用 localStorage 存储连接配置存在以下问题：
1. **安全性问题**：localStorage 明文存储，密码等敏感信息容易泄露
2. **数据丢失风险**：清除浏览器缓存会导致数据丢失
3. **跨浏览器不兼容**：数据与特定浏览器绑定

## Functional Requirements
- **FR-1**: 后端提供连接配置的 CRUD API
- **FR-2**: 密码等敏感信息应加密存储
- **FR-3**: 前端启动时从后端加载连接配置
- **FR-4**: 连接配置变更时同步到后端存储
- **FR-5**: 存储文件应位于用户配置目录（如 ~/.linkbase/connections.json）

## Non-Functional Requirements
- **NFR-1**: 加密算法应使用安全的 AES-256
- **NFR-2**: 文件操作应异步执行，不阻塞 UI
- **NFR-3**: 存储格式应向后兼容

## Constraints
- **Technical**: 使用 Tauri 的文件系统 API
- **Dependencies**: 依赖 Tauri 的 fs 模块

## Acceptance Criteria

### AC-1: 连接配置后端存储
- **Given**: 用户创建了一个新的数据库连接
- **When**: 连接添加成功后
- **Then**: 连接配置应保存到后端本地文件
- **Verification**: `programmatic`

### AC-2: 密码加密存储
- **Given**: 用户创建了包含密码的数据库连接
- **When**: 连接保存后
- **Then**: 文件中存储的密码应是加密后的字符串
- **Verification**: `programmatic`

### AC-3: 前端启动自动加载
- **Given**: 用户之前创建了连接配置并关闭了工具
- **When**: 用户重新打开工具
- **Then**: 之前的连接配置应从后端文件自动加载
- **Verification**: `human-judgment`

### AC-4: 密码自动解密
- **Given**: 用户加载了已保存的连接
- **When**: 需要使用密码连接数据库时
- **Then**: 后端应自动解密密码并使用
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要提供主密码保护机制？（当前阶段不考虑）
