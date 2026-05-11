<template>
  <div class="connection-tree" @contextmenu.prevent="onPanelContextMenu">
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

    <div class="tree-content">
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
import { ref, onMounted } from 'vue'
import { NTree, NInput, NButton, NIcon, type TreeOption } from 'naive-ui'
import { SearchOutline, AddOutline } from '@vicons/ionicons5'
import { LContextMenu } from '@linkbase/components'
import { useConnectionTree } from '../composables/useConnectionTree'

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
  onExpandedKeysChange,
  onSelectedKeysChange,
  onPanelContextMenu,
  onContextMenuSelect,
  handleNodeDblClick,
  allowDrop,
  onDrop,
} = useConnectionTree(emit)

onMounted(() => {
  initTreeData()
})
</script>