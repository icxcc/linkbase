<template>
  <div class="connection-tree" @contextmenu.prevent.self="onPanelContextMenu">
    <div class="tree-toolbar">
      <n-input
        v-model:value="searchText"
        :placeholder="$t('connection.searchPlaceholder')"
        clearable
        size="small"
      >
        <template #prefix>
          <n-icon><SearchOutline /></n-icon>
        </template>
      </n-input>
      <n-button size="small" quaternary @click="$emit('openCreateDialog')" :title="$t('connection.newConnection')">
        <template #icon><n-icon><AddOutline /></n-icon></template>
      </n-button>
    </div>

    <div class="tree-content" v-if="treeData.length > 0" @contextmenu.prevent="onTreeAreaContextMenu">
      <n-tree
        ref="treeRef"
        :data="treeData"
        :expanded-keys="expandedKeys"
        :selected-keys="selectedKeys"
        :pattern="searchText"
        :node-props="nodeProps"
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
import { ref, onMounted, h } from 'vue'
import { NTree, NInput, NButton, NIcon, NTooltip, type TreeOption } from 'naive-ui'
import { SearchOutline, AddOutline, RefreshOutline, ServerOutline } from '@vicons/ionicons5'
import { LContextMenu } from '@linkbase/components'
import { useConnectionTree } from '../composables/useConnectionTree'
import { useConnectionStore } from '@linkbase/core/stores/connection'

const ChevronCollapseOutline = {
  render() {
    return h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 512 512', fill: 'currentColor' }, [
      h('path', { d: 'M256 48l-160 160h320L256 48zM256 464l160-160H96l160 160z' })
    ])
  }
}

const emit = defineEmits<{
  openCreateDialog: []
  openEditDialog: [connectionId: string]
  executeSql: [sql: string]
}>()

const treeRef = ref<InstanceType<typeof NTree> | null>(null)

const {
  treeData,
  expandedKeys,
  selectedKeys,
  searchText,
  contextMenu,
  nodeProps,
  initTreeData,
  refreshConnection,
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