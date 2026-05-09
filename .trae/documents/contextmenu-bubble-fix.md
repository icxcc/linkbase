# 节点右键菜单与外层面板右键冲突修复

## 问题描述
右键点击树节点（连接/分组/表等）时，只显示"新建连接"和"新建分组"，不显示节点专属的右键菜单。

## 根因分析

存在两层右键事件：

| 层级 | 位置 | 事件 | 效果 |
|------|------|------|------|
| 外层 | `<div class="connection-tree">` 第2行 | `@contextmenu.prevent="onPanelContextMenu"` | 总是显示「新建连接 + 新建分组」 |
| 节点层 | `nodeProps` 第739-749行 | `onContextmenu(e)` → `showContextMenu(...)` | 设置节点专属菜单项 |

右键点击树节点时，事件流如下：
1. `nodeProps` 的 `onContextmenu` 先触发 → 正确设置 `contextMenu.value`（连接/分组/表等专属菜单）
2. 事件**冒泡**到外层 `<div>` → `onPanelContextMenu` 触发 → **覆盖** `contextMenu.value` 为面板菜单（只有「新建连接 + 新建分组」）

`e.preventDefault()` 只阻止浏览器默认右键菜单，**不阻止事件冒泡**，所以外层 handler 仍然会执行。

## 修复方案

在 `nodeProps` 的 `onContextmenu` 中添加 `e.stopPropagation()`，阻止事件冒泡到外层 div。

**修改位置**：`packages/connection/src/components/ConnectionTree.vue` 第739-749行

```diff
 function nodeProps({ option }: { option: TreeOption }) {
   const nodeData = getNodeData(option)
   return {
     onContextmenu(e: MouseEvent) {
       e.preventDefault()
+      e.stopPropagation()
       showContextMenu(e, option, nodeData)
     },
     ondblclick() {
       handleNodeDblClick(option)
     },
   }
 }
```

## 涉及文件
- `packages/connection/src/components/ConnectionTree.vue` — 在 `nodeProps` 函数中添加 `e.stopPropagation()`

## 验证步骤
1. 右键点击连接节点 → 应显示「连接/断开/编辑/刷新/测试连接/复制连接/删除」
2. 右键点击分组节点 → 应显示「新建连接/重命名/删除分组」
3. 右键点击表节点 → 应显示「生成 SELECT/复制表名」
4. 右键点击面板空白区域 → 应显示「新建连接/新建分组」
