<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NTree, NInput, NIcon, NSpin } from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import { SearchOutline, ServerOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { useEditorStore } from '@linkbase/core/stores/editor'
import { getMetadata } from '@linkbase/core/api'

interface DbNode extends TreeOption {
  type?: 'connection' | 'database' | 'schema' | 'table' | 'view' | 'column'
  tableName?: string
  schemaName?: string
}

const connectionStore = useConnectionStore()
const editorStore = useEditorStore()

const searchText = ref('')
const treeData = ref<DbNode[]>([])
const loading = ref(false)
const expandedKeys = ref<string[]>([])

async function loadMetadata() {
  if (!connectionStore.currentConnectionId) {
    treeData.value = []
    return
  }
  loading.value = true
  try {
    const metadata = await getMetadata(connectionStore.currentConnectionId)
    const nodes: DbNode[] = []

    const schemaMap = new Map<string, { tables: DbNode[]; views: DbNode[] }>()

    for (const table of metadata.tables) {
      const parts = table.name.split('.')
      const schemaName = parts.length > 1 ? parts[0] : 'default'
      const shortName = parts.length > 1 ? parts.slice(1).join('.') : table.name

      if (!schemaMap.has(schemaName)) {
        schemaMap.set(schemaName, { tables: [], views: [] })
      }

      const group = schemaMap.get(schemaName)!
      const columns: DbNode[] = table.columns.map((col) => ({
        key: `col:${table.name}:${col.name}`,
        label: `${col.name} (${col.data_type})`,
        type: 'column' as const,
        isLeaf: true,
      }))

      const tableNode: DbNode = {
        key: `table:${table.name}`,
        label: shortName,
        type: 'table',
        tableName: table.name,
        children: columns,
      }
      group.tables.push(tableNode)
    }

    for (const [schemaName, group] of schemaMap.entries()) {
      const children: DbNode[] = []
      if (group.tables.length > 0) {
        children.push({
          key: `tables-group:${schemaName}`,
          label: 'Tables',
          children: group.tables,
        })
      }
      if (group.views.length > 0) {
        children.push({
          key: `views-group:${schemaName}`,
          label: 'Views',
          children: group.views,
        })
      }

      if (schemaName === 'default' && schemaMap.size === 1) {
        nodes.push(...children)
      } else {
        nodes.push({
          key: `schema:${schemaName}`,
          label: schemaName,
          type: 'schema',
          children,
        })
      }
    }

    treeData.value = nodes
  } catch (err) {
    console.error('Failed to load metadata:', err)
  } finally {
    loading.value = false
  }
}

function handleNodeClick(node: DbNode) {
  if (node.type === 'table' && node.tableName) {
    const sql = `SELECT * FROM ${node.tableName} LIMIT 100`
    if (editorStore.activeTabId) {
      editorStore.updateTabSql(editorStore.activeTabId, sql)
    }
    window.dispatchEvent(new CustomEvent('sql:fill', { detail: sql }))
    window.dispatchEvent(new CustomEvent('sql:execute-request'))
  }
}

function filterNodes(nodes: DbNode[], query: string): DbNode[] {
  if (!query) return nodes
  const q = query.toLowerCase()
  return nodes
    .filter((n) => {
      if (n.label?.toLowerCase().includes(q)) return true
      if (n.children) {
        const filtered = filterNodes(n.children as DbNode[], q)
        if (filtered.length > 0) {
          n.children = filtered
          return true
        }
      }
      return false
    })
    .map((n) => ({ ...n }))
}

const displayTree = computed(() => filterNodes(treeData.value, searchText.value))

watch(() => connectionStore.currentConnectionId, () => {
  loadMetadata()
}, { immediate: true })
</script>

<template>
  <div class="schema-tree">
    <div class="schema-header">
      <span class="schema-title">对象浏览器</span>
    </div>
    <div class="schema-search">
      <NInput
        v-model:value="searchText"
        size="small"
        placeholder="搜索表名..."
        clearable
      >
        <template #prefix><NIcon size="14"><SearchOutline /></NIcon></template>
      </NInput>
    </div>
    <NSpin :show="loading" size="small">
      <NTree
        v-if="displayTree.length > 0"
        :data="displayTree"
        :expanded-keys="expandedKeys"
        block-line
        selectable
        @update:expanded-keys="(keys: any) => expandedKeys = keys"
        @node-click="(node: any) => handleNodeClick(node as DbNode)"
      />
      <div v-else class="schema-empty">
        <NIcon size="20" :depth="3"><ServerOutline /></NIcon>
        <span>{{ searchText ? '无匹配结果' : '暂无对象' }}</span>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.schema-tree { padding: 0; overflow-y: auto; flex: 1; }
.schema-header { padding: 8px 12px 0; }
.schema-title { font-size: 11px; font-weight: 600; color: var(--lb-text-secondary); text-transform: uppercase; }
.schema-search { padding: 6px 12px; }
.schema-empty {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 0; color: var(--lb-text-secondary); font-size: 12px;
}
</style>
