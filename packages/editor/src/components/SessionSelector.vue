<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { useEditorStore } from '@linkbase/core/stores/editor'
import { getDatabases, getSchemas, switchDatabase } from '@linkbase/core/api'
import { TREE_NODE_TEMPLATES } from '@linkbase/connection/config/database-types'
import type { DriverType } from '@linkbase/core/api'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const editorStore = useEditorStore()

const databases = ref<string[]>([])
const schemas = ref<string[]>([])
const loadingDbs = ref(false)
const loadingSchemas = ref(false)

const activeTab = computed(() =>
  editorStore.tabs.find((tab) => tab.id === editorStore.activeTabId) ?? null
)

const session = computed(() => activeTab.value?.session ?? null)

const connectedConnections = computed(() =>
  connectionStore.connections.filter((c) => c.status === 'connected')
)

const selectedConnection = computed(() =>
  connectionStore.connections.find((c) => c.id === session.value?.connectionId) ?? null
)

const driverType = computed<DriverType | null>(() => {
  if (!selectedConnection.value) return null
  return selectedConnection.value.driver_type as DriverType
})

const treeTemplate = computed(() => {
  if (!driverType.value) return null
  return TREE_NODE_TEMPLATES[driverType.value] ?? null
})

const showDatabaseSelector = computed(() => {
  if (!treeTemplate.value) return false
  return treeTemplate.value.rootContainerType === 'databases'
    || treeTemplate.value.rootContainerType === 'databases_with_schemas'
})

const showSchemaSelector = computed(() => {
  if (!treeTemplate.value) return false
  return treeTemplate.value.rootContainerType === 'databases_with_schemas'
    || treeTemplate.value.rootContainerType === 'schemas'
})

async function loadDatabases() {
  if (!session.value?.connectionId) {
    databases.value = []
    return
  }
  loadingDbs.value = true
  try {
    databases.value = await getDatabases(session.value.connectionId)
  } catch {
    databases.value = []
  } finally {
    loadingDbs.value = false
  }
}

async function loadSchemas() {
  if (!session.value?.connectionId) {
    schemas.value = []
    return
  }
  loadingSchemas.value = true
  try {
    schemas.value = await getSchemas(session.value.connectionId, session.value?.database ?? undefined)
  } catch {
    schemas.value = []
  } finally {
    loadingSchemas.value = false
  }
}

function onConnectionChange(connId: string) {
  if (!editorStore.activeTabId) return
  editorStore.updateTabSession(editorStore.activeTabId, {
    connectionId: connId || null,
    database: null,
    schema: null,
  })
}

function onDatabaseChange(db: string) {
  if (!editorStore.activeTabId) return
  editorStore.updateTabSession(editorStore.activeTabId, {
    database: db || null,
    schema: null,
  })
  // Actually switch database on the backend connection
  if (db && session.value?.connectionId) {
    switchDatabase(session.value.connectionId, db).catch(() => {
      // silently ignore - error will surface when executing SQL
    })
  }
}

function onSchemaChange(schema: string) {
  if (!editorStore.activeTabId) return
  editorStore.updateTabSession(editorStore.activeTabId, {
    schema: schema || null,
  })
}

// Watch connection changes to load databases
watch(
  () => session.value?.connectionId,
  async (connId) => {
    databases.value = []
    schemas.value = []
    if (connId) {
      await loadDatabases()
      if (showSchemaSelector.value && !showDatabaseSelector.value) {
        await loadSchemas()
      }
    }
  },
  { immediate: true },
)

// Watch database changes to load schemas
watch(
  () => session.value?.database,
  async (db) => {
    schemas.value = []
    if (db && showSchemaSelector.value) {
      await loadSchemas()
    }
  },
)

// Reload when active tab changes
watch(
  () => editorStore.activeTabId,
  async () => {
    if (session.value?.connectionId) {
      await loadDatabases()
      if (session.value?.database && showSchemaSelector.value) {
        await loadSchemas()
      } else if (showSchemaSelector.value && !showDatabaseSelector.value) {
        await loadSchemas()
      }
    }
  },
)
</script>

<template>
  <div class="session-selector">
    <!-- Connection Selector -->
    <div class="selector-item">
      <select
        :value="session?.connectionId ?? ''"
        class="session-select"
        @change="onConnectionChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('session.selectConnection') }}</option>
        <option
          v-for="conn in connectedConnections"
          :key="conn.id"
          :value="conn.id"
        >
          {{ conn.name }}
        </option>
      </select>
    </div>

    <!-- Database Selector -->
    <div v-if="showDatabaseSelector && session?.connectionId" class="selector-item">
      <select
        :value="session?.database ?? ''"
        class="session-select"
        :disabled="loadingDbs"
        @change="onDatabaseChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ loadingDbs ? t('session.loading') : t('session.selectDatabase') }}</option>
        <option v-for="db in databases" :key="db" :value="db">{{ db }}</option>
      </select>
    </div>

    <!-- Schema Selector -->
    <div v-if="showSchemaSelector && session?.connectionId && (session?.database || !showDatabaseSelector)" class="selector-item">
      <select
        :value="session?.schema ?? ''"
        class="session-select"
        :disabled="loadingSchemas"
        @change="onSchemaChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ loadingSchemas ? t('session.loading') : t('session.selectSchema') }}</option>
        <option v-for="s in schemas" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.session-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.selector-item {
  display: flex;
  align-items: center;
}

.session-select {
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid var(--lb-border-color, #333);
  background: var(--lb-bg-secondary, #313244);
  color: var(--lb-text-primary, #cdd6f4);
  font-size: 11px;
  max-width: 160px;
  min-width: 80px;
  cursor: pointer;
  outline: none;
}

.session-select:hover {
  border-color: var(--lb-accent-color, #89b4fa);
}

.session-select:focus {
  border-color: var(--lb-accent-color, #89b4fa);
  box-shadow: 0 0 0 1px var(--lb-accent-color, #89b4fa);
}

.session-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
