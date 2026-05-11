# LinkBase

LinkBase 是一款现代化的数据库管理工具，支持多种数据库类型，提供高效的 SQL 编辑和数据浏览体验。

## ✨ 功能特性

- **多数据库支持**: MySQL、PostgreSQL、SQLite
- **高效 SQL 编辑器**: 基于 Monaco Editor，支持语法高亮和智能提示
- **虚拟滚动**: 支持百万级数据量的流畅渲染
- **连接管理**: 可视化连接配置和管理
- **事务支持**: 完整的事务管理功能
- **查询历史**: 自动保存查询历史记录
- **主题切换**: 支持深色/浅色主题

## 🛠️ 技术栈

### 前端
- Vue 3 + Composition API
- TypeScript
- Pinia (状态管理)
- Vue Router
- Monaco Editor
- Tailwind CSS 3

### 后端
- Rust
- Tauri
- SQLx
- tokio

## 📦 项目结构

```
linkbase/
├── apps/
│   └── desktop/              # Tauri 桌面应用
│       ├── src/              # Vue 前端代码
│       └── src-tauri/        # Rust 后端代码
│           └── crates/       # Rust 库
│               ├── core/     # 核心业务逻辑
│               ├── db-common/# 数据库通用类型
│               └── drivers/  # 数据库驱动
├── packages/                 # 前端共享包
│   ├── components/           # 通用组件库
│   ├── connection/           # 连接管理模块
│   ├── core/                 # 核心功能（路由、状态、API）
│   ├── editor/               # SQL 编辑器模块
│   ├── result/               # 结果展示模块
│   └── schema/               # 元数据模块
└── package.json
```

## 🚀 快速开始

### 前置要求

- Node.js >= 20
- Rust >= 1.70
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm run dev
```

### 构建生产版本

```bash
pnpm run build
```

### 运行测试

```bash
pnpm run test
```

## 📖 使用说明

### 1. 创建连接

1. 点击左侧连接面板的"新建连接"按钮
2. 选择数据库类型
3. 填写连接信息（主机、端口、用户名、密码、数据库名）
4. 点击"测试连接"验证配置
5. 点击"保存"完成创建

### 2. 执行 SQL

1. 选择已连接的数据库
2. 在编辑器中输入 SQL 语句
3. 点击执行按钮或按 `Ctrl+Enter`
4. 在结果面板查看执行结果

### 3. 管理连接

- **编辑连接**: 右键点击连接，选择"编辑"
- **复制连接**: 右键点击连接，选择"复制"
- **删除连接**: 右键点击连接，选择"删除"
- **断开连接**: 点击连接旁的断开按钮

## 🤝 贡献指南

### 提交规范

请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 代码重构
- `perf`: 性能优化
- `docs`: 文档更新
- `test`: 测试相关
- `build`: 构建配置

### 分支规范

- `feature/*`: 新功能开发
- `fix/*`: Bug 修复
- `refactor/*`: 代码重构
- `release/*`: 版本发布

## 📝 许可证

MIT License

## 📧 联系方式

如有问题或建议，请提交 Issue 或 PR。
