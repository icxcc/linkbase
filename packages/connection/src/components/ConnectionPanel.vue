<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NInput, NSelect, NList, NListItem, NThing,
  NSpace, NTag, NModal, NForm, NFormItem, NRadioGroup, NRadio, NIcon,
  useMessage,
} from 'naive-ui'
import {
  AddOutline, TrashOutline, LinkOutline, UnlinkOutline,
  ServerOutline, DocumentOutline,
} from '@vicons/ionicons5'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { connect, disconnect, extractErrorMessage, type ConnectionConfig } from '@linkbase/core/api'

const { t } = useI18n()
const emit = defineEmits<{
  (e: 'connection-changed', id: string | null): void
}>()

const message = useMessage()
const store = useConnectionStore()

const showModal = ref(false)
const isSubmitting = ref(false)

const formModel = ref({
  name: '',
  driver_type: 'sqlite' as 'sqlite' | 'odbc',
  sqliteMode: 'memory' as 'memory' | 'file',
  filePath: '',
})

const connectionStatuses = ref<Record<string, 'connected' | 'disconnected'>>({})

const driverOptions = [
  { label: 'SQLite', value: 'sqlite' },
  { label: 'ODBC', value: 'odbc' },
]

const connections = computed(() =>
  store.connections.map((c) => ({
    ...c,
    status: connectionStatuses.value[c.id] ?? 'disconnected',
  }))
)

function openModal() {
  formModel.value = { name: '', driver_type: 'sqlite', sqliteMode: 'memory', filePath: '' }
  showModal.value = true
}

function buildConnectionString(): string {
  if (formModel.value.driver_type === 'sqlite') {
    return formModel.value.sqliteMode === 'memory' ? ':memory:' : formModel.value.filePath.trim()
  }
  return ''
}

async function handleSave() {
  if (!formModel.value.name.trim()) {
    message.error(t('connection.enterName'))
    return
  }
  if (formModel.value.driver_type === 'sqlite' && formModel.value.sqliteMode === 'file' && !formModel.value.filePath.trim()) {
    message.error(t('connection.enterPath'))
    return
  }

  isSubmitting.value = true
  try {
    const config: ConnectionConfig = {
      driver_type: formModel.value.driver_type,
      connection_string: buildConnectionString(),
      options: {},
    }
    const backendId = await connect(config)
    store.addConnection({ id: backendId, name: formModel.value.name.trim(), host: config.connection_string, port: 0 })
    connectionStatuses.value[backendId] = 'connected'
    store.setCurrentConnection(backendId)
    emit('connection-changed', backendId)
    message.success(t('connection.connectSuccess'))
    showModal.value = false
  } catch (err: unknown) {
    message.error(extractErrorMessage(err))
  } finally {
    isSubmitting.value = false
  }
}

async function handleConnect(id: string) {
  const conn = store.connections.find((c) => c.id === id)
  if (!conn) return
  try {
    const config: ConnectionConfig = { driver_type: 'sqlite', connection_string: conn.host, options: {} }
    const backendId = await connect(config)
    if (backendId !== id) {
      store.removeConnection(id)
      store.addConnection({ id: backendId, name: conn.name, host: conn.host, port: conn.port })
      connectionStatuses.value[backendId] = connectionStatuses.value[id] ?? 'disconnected'
      delete connectionStatuses.value[id]
    } else {
      connectionStatuses.value[id] = 'connected'
    }
    store.setCurrentConnection(backendId)
    emit('connection-changed', backendId)
    message.success(t('connection.connectSuccess'))
  } catch (err: unknown) {
    message.error(extractErrorMessage(err))
  }
}

async function handleDisconnect(id: string) {
  try {
    await disconnect(id)
    connectionStatuses.value[id] = 'disconnected'
    message.success(t('connection.disconnected'))
  } catch (err: unknown) {
    message.error(extractErrorMessage(err))
  }
}

function handleDelete(id: string) {
  store.removeConnection(id)
  delete connectionStatuses.value[id]
  if (store.currentConnectionId === id) {
    emit('connection-changed', null)
  }
  message.success(t('connection.deleted'))
}

function statusType(status: string) {
  return status === 'connected' ? 'success' : ('default' as const)
}

function statusText(status: string) {
  return status === 'connected' ? t('connection.connectedStatus') : t('connection.notConnectedStatus')
}
</script>

<template>
  <div class="connection-panel">
    <div class="connection-header">
      <span class="connection-title">{{ t('connection.connections') }}</span>
      <NButton size="tiny" @click="openModal">
        <template #icon><NIcon size="14"><AddOutline /></NIcon></template>
      </NButton>
    </div>

    <NList v-if="connections.length" class="conn-list">
      <NListItem v-for="conn in connections" :key="conn.id">
        <NThing>
          <template #header>
            <NSpace align="center" size="small">
              <NIcon size="14"><ServerOutline /></NIcon>
              <span class="conn-name">{{ conn.name }}</span>
              <NTag :type="statusType(conn.status)" size="small" :bordered="false">
                {{ statusText(conn.status) }}
              </NTag>
            </NSpace>
          </template>
          <template #description><span class="conn-meta">{{ conn.host }}</span></template>
          <template #action>
            <NSpace size="small">
              <NButton v-if="conn.status !== 'connected'" size="tiny" quaternary @click="handleConnect(conn.id)">
                <template #icon><NIcon size="14"><LinkOutline /></NIcon></template>
              </NButton>
              <NButton v-else size="tiny" quaternary @click="handleDisconnect(conn.id)">
                <template #icon><NIcon size="14"><UnlinkOutline /></NIcon></template>
              </NButton>
              <NButton size="tiny" quaternary type="error" @click="handleDelete(conn.id)">
                <template #icon><NIcon size="14"><TrashOutline /></NIcon></template>
              </NButton>
            </NSpace>
          </template>
        </NThing>
      </NListItem>
    </NList>

    <div v-else class="empty-state">
      <NIcon size="24" :depth="3"><DocumentOutline /></NIcon>
      <span>{{ t('connection.noConnections') }}</span>
    </div>

    <NModal v-model:show="showModal" :title="t('connection.newConnection')" preset="card" style="width: 480px" :mask-closable="false">
      <NForm label-placement="left" label-width="100px">
        <NFormItem :label="t('connection.connectionName')">
          <NInput v-model:value="formModel.name" :placeholder="t('connection.namePlaceholder')" />
        </NFormItem>
        <NFormItem :label="t('connection.driverType')">
          <NSelect v-model:value="formModel.driver_type" :options="driverOptions" />
        </NFormItem>
        <template v-if="formModel.driver_type === 'sqlite'">
          <NFormItem :label="t('connection.mode')">
            <NRadioGroup v-model:value="formModel.sqliteMode">
              <NSpace>
                <NRadio value="memory">{{ t('connection.memory') }}</NRadio>
                <NRadio value="file">{{ t('connection.file') }}</NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>
          <NFormItem v-if="formModel.sqliteMode === 'file'" :label="t('connection.filePath')">
            <NInput v-model:value="formModel.filePath" :placeholder="t('connection.filePathPlaceholder')" />
          </NFormItem>
        </template>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showModal = false">{{ t('connection.cancel') }}</NButton>
          <NButton type="primary" :loading="isSubmitting" @click="handleSave">{{ t('connection.saveAndConnect') }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.connection-panel { padding: 10px 12px; overflow-y: auto; flex-shrink: 0; max-height: 40%; }
.connection-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.connection-title {
  font-size: 11px; font-weight: 600; color: var(--lb-text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.conn-list { margin: 0 -12px; }
.conn-name { font-size: 13px; font-weight: 500; }
.conn-meta { font-size: 11px; color: var(--lb-text-secondary); }
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 24px 0; gap: 8px; color: var(--lb-text-secondary); font-size: 12px;
}
</style>
