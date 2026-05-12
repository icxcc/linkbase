<template>
  <div class="connection-tree" @contextmenu.prevent.self="onPanelContextMenu">
    <div class="tree-toolbar">
      <n-input
        v-model:value="searchText"
        :placeholder="$t('connection.searchPlaceholder')"
        clearable
        size="small"
        class="tree-search"
      >
        <template #prefix>
          <n-icon size="14"><SearchOutline /></n-icon>
        </template>
      </n-input>
      <div class="tree-toolbar-actions">
        <n-tooltip trigger="hover" :delay="500">
          <template #trigger>
            <n-button size="tiny" quaternary @click="collapseAll" class="toolbar-icon-btn">
              <template #icon><n-icon size="14"><ChevronCollapseOutline /></n-icon></template>
            </n-button>
          </template>
          {{ $t('connection.collapseAll') }}
        </n-tooltip>
        <n-tooltip trigger="hover" :delay="500">
          <template #trigger>
            <n-button size="tiny" quaternary @click="refreshAll" class="toolbar-icon-btn">
              <template #icon><n-icon size="14"><RefreshOutline /></n-icon></template>
            </n-button>
          </template>
          {{ $t('connection.refresh') }}
        </n-tooltip>
        <n-tooltip trigger="hover" :delay="500">
          <template #trigger>
            <n-button size="tiny" quaternary @click="$emit('openCreateDialog')" class="toolbar-icon-btn">
              <template #icon><n-icon size="14"><AddOutline /></n-icon></template>
            </n-button>
          </template>
          {{ $t('connection.newConnection') }}
        </n-tooltip>
      </div>
    </div>

    <div class="tree-content" v-if="treeData.length > 0" @contextmenu.prevent="onTreeAreaContextMenu">
      <n-tree
        ref="treeRef"
        :data="treeData"
        :expanded-keys="expandedKeys"
        :selected-keys="selectedKeys"
        :pattern="searchText"
        :node-props="nodeProps"
        :on-load="handleLazyLoad"
        block-line
        selectable
        :draggable="true"
        :allow-drop="allowDrop as any"
        @update:expanded-keys="onExpandedKeysChange"
        @update:selected-keys="onSelectedKeysChange"
        @drop="onDrop as any"
        virtual-scroll
        style="height: 100%"
        @node-click="handleNodeDblClick"
      />
    </div>

    <div class="tree-empty" v-else>
      <div class="empty-icon">
        <n-icon size="48" :depth="3"><ServerOutline /></n-icon>
      </div>
      <p class="empty-title">{{ $t('connection.noConnections') }}</p>
      <p class="empty-hint">{{ $t('connection.emptyHint') }}</p>
      <n-button size="small" type="primary" ghost @click="$emit('openCreateDialog')">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        {{ $t('connection.newConnection') }}
      </n-button>
    </div>

    <LContextMenu
      :show="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @close="contextMenu.show = false"
      @select="onContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NTree, NInput, NButton, NIcon, NTooltip, type TreeOption } from 'naive-ui'
import { SearchOutline, AddOutline, RefreshOutline, ServerOutline } from '@vicons/ionicons5'
import { LContextMenu } from '@linkbase/components'
import { useConnectionTree } from '../composables/useConnectionTree'
import { useConnectionStore } from '@linkbase/core/stores/connection'

// ChevronCollapseOutline doesn't exist in ionicons5; we'll use a substitute
const ChevronCollapseOutline = {
  render() {
    return h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 512 512', fill: 'currentColor' }, [
      h('path', { d: 'M256 48l-160 160h320L256 48zM256 464l160-160H96l160 160z' })
    ])
  }
}

import { h } from 'vue'

const emit = defineEmits<{
  openCreateDialog: []
  openEditDialog: [connectionId: string]
  executeSql: [sql: string]
}>()

const treeRef = ref<InstanceType<typeof NTree> | null>(null)
const connectionStore = useConnectionStore()

const {
  treeData,
  expandedKeys,
  selectedKeys,
  searchText,
  contextMenu,
  nodeProps,
  initTreeData,
  refreshConnection,
  handleLazyLoad,
  onExpandedKeysChange,
  onSelectedKeysChange,
  onPanelContextMenu,
  onContextMenuSelect,
  handleNodeDblClick,
  allowDrop,
  onDrop,
} = useConnectionTree(emit)

function onTreeAreaContextMenu(e: MouseEvent) {
  // Only show panel context menu if clicking on empty area (not on a tree node)
  const target = e.target as HTMLElement
  const isNodeClick = target.closest('.n-tree-node')
  if (!isNodeClick) {
    onPanelContextMenu(e)
  }
}

function collapseAll() {
  expandedKeys.value = []
}

function refreshAll() {
  for (const conn of connectionStore.connections) {
    if (conn.status === 'connected') {
      refreshConnection(conn.id)
    }
  }
}

onMounted(() => {
  initTreeData()
})
</script>

<style scoped>
.connection-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 6px;
  border-bottom: 1px solid var(--lb-border-color);
}

.tree-search {
  flex: 1;
}

.tree-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0;
}

.toolbar-icon-btn {
  width: 26px;
  height: 26px;
  padding: 0;
}

.tree-content {
  flex: 1;
  overflow: hidden;
  padding: 4px 0;
}

.tree-content :deep(.n-tree-node) {
  padding: 0 4px;
  border-radius: 4px;
  margin: 0 4px;
  transition: background-color 0.15s;
}

.tree-content :deep(.n-tree-node:hover) {
  background-color: var(--lb-hover-bg, rgba(255, 255, 255, 0.04));
}

.tree-content :deep(.n-tree-node--selected) {
  background-color: var(--lb-active-bg, rgba(137, 180, 250, 0.12)) !important;
}

.tree-content :deep(.n-tree-node-content) {
  padding: 3px 0;
}

.tree-content :deep(.n-tree-node-content__text) {
  font-size: 12.5px;
  color: var(--lb-text-primary);
}

.tree-content :deep(.n-tree-node-indent) {
  width: 16px;
}

.tree-content :deep(.n-tree-node-switcher) {
  width: 20px;
  height: 20px;
}

.tree-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 8px;
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 8px;
}

.empty-title {
  margin: 0;
  font-size: 13px;
  color: var(--lb-text-primary);
  font-weight: 500;
}

.empty-hint {
  margin: 0;
  font-size: 11px;
  color: var(--lb-text-secondary);
  text-align: center;
  line-height: 1.5;
}
</style>
