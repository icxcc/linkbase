<template>
  <LModal :show="visible" :title="isEditing ? $t('connection.editConnection') : $t('connection.newConnection')" @close="$emit('close')">
    <div class="conn-dialog">
      <div class="conn-dialog-left">
        <div
          v-for="driver in driverTypes"
          :key="driver.type"
          class="driver-item"
          :class="{ active: selectedDriver === driver.type }"
          @click="selectDriver(driver.type)"
        >
          <n-icon size="24"><ServerOutline /></n-icon>
          <span class="driver-name">{{ driver.name }}</span>
        </div>
      </div>

      <div class="conn-dialog-right">
        <n-form ref="formRef" :model="formModel" label-placement="top" size="small">
          <template v-for="field in currentFields" :key="field.key">
            <n-form-item v-if="field.type === 'text'" :label="field.label">
              <n-input :value="getValue(field.key)" @update:value="(v: string) => setValue(field.key, v)" :placeholder="field.placeholder" />
            </n-form-item>
            <n-form-item v-else-if="field.type === 'password'" :label="field.label">
              <n-input :value="getValue(field.key)" @update:value="(v: string) => setValue(field.key, v)" type="password" show-password-on="click" :placeholder="field.placeholder" />
            </n-form-item>
            <n-form-item v-else-if="field.type === 'number'" :label="field.label">
              <n-input-number :value="getNumValue(field.key)" @update:value="(v: number | null) => setNumValue(field.key, v)" :placeholder="field.placeholder" />
            </n-form-item>
            <n-form-item v-else-if="field.type === 'select'" :label="field.label">
              <n-select :value="getValue(field.key)" @update:value="(v: string) => setValue(field.key, v)" :options="(field.options || []) as any" />
            </n-form-item>
            <n-form-item v-else-if="field.type === 'file'" :label="field.label">
              <div style="display:flex;gap:8px;">
                <n-input :value="getValue('filePath')" readonly style="flex:1" />
                <n-button size="small" @click="browseFile">{{ $t('connection.browse') }}</n-button>
              </div>
            </n-form-item>
          </template>

          <div v-if="testResult !== null" class="test-result" :class="{ success: testResult.success, fail: !testResult.success }">
            <template v-if="testResult.success">
              连接成功! 服务器版本: {{ testResult.server_version }}, 延迟: {{ testResult.latency_ms.toFixed(1) }}ms
            </template>
            <template v-else>
              连接失败: {{ testError }}
            </template>
          </div>

          <div class="dialog-footer">
            <n-button quaternary @click="handleTestConnection">
              <n-icon size="16"><PulseOutline /></n-icon>
              {{ $t('connection.testConnection') }}
            </n-button>
            <n-space>
              <n-button quaternary @click="$emit('close')">{{ $t('common.cancel') }}</n-button>
              <n-button type="primary" @click="handleSave">{{ $t('connection.saveAndConnect') }}</n-button>
            </n-space>
          </div>
        </n-form>
      </div>
      <input ref="fileInputRef" type="file" accept=".db,.sqlite,.sqlite3" style="display:none" @change="onFileSelected" />
    </div>
  </LModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { LModal } from '@linkbase/components'
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NButton, NIcon, NSpace } from 'naive-ui'
import { ServerOutline, PulseOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@linkbase/core/stores/connection'
import { connect, testConnection as testConnectionApi, type ConnectionConfig } from '@linkbase/core/api'
import { DRIVER_CONFIGS } from '../config/database-types'
import type { DriverType, DriverConfig, DriverFieldConfig } from '../config/database-types'

const props = defineProps<{ visible: boolean; connectionId?: string }>()
const emit = defineEmits<{ close: [] }>()

const connectionStore = useConnectionStore()

const driverTypes: { type: DriverType; name: string }[] = [
  { type: 'sqlite', name: 'SQLite' },
  { type: 'mysql', name: 'MySQL' },
  { type: 'postgres', name: 'PostgreSQL' },
  { type: 'oracle', name: 'Oracle' },
]

const selectedDriver = ref<DriverType>('sqlite')
const formModel = reactive<Record<string, string | number>>({})
const testResult = ref<{ success: boolean; server_version: string; latency_ms: number } | null>(null)
const testError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const currentConfig = computed<DriverConfig>(() => DRIVER_CONFIGS[selectedDriver.value])
const currentFields = computed<DriverFieldConfig[]>(() => currentConfig.value.fields)

function getValue(key: string): string {
  const val = formModel[key]
  return typeof val === 'string' ? val : String(val ?? '')
}

function setValue(key: string, value: string) {
  formModel[key] = value
}

function getNumValue(key: string): number | null {
  const val = formModel[key]
  if (val === '' || val === undefined || val === null) return null
  return typeof val === 'number' ? val : Number(val)
}

function setNumValue(key: string, value: number | null) {
  formModel[key] = value ?? 0
}

function browseFile() {
  fileInputRef.value?.click()
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    formModel.filePath = input.files[0].name
  }
}

const isEditing = computed(() => !!props.connectionId)

watch(() => props.visible, (val) => {
  if (val) {
    if (props.connectionId) {
      loadConnection(props.connectionId)
    } else {
      selectedDriver.value = 'sqlite'
      initForm('sqlite')
    }
    testResult.value = null
    testError.value = ''
  }
})

async function loadConnection(id: string) {
  const conn = connectionStore.connections.find(c => c.id === id)
  if (!conn) return

  selectedDriver.value = conn.driver_type as DriverType
  initForm(conn.driver_type as DriverType)
  
  formModel.name = conn.name
  if (conn.host) formModel.host = conn.host
  if (conn.port) formModel.port = conn.port
  if (conn.user) formModel.user = conn.user
  if (conn.username) formModel.user = conn.username
  if (conn.database) formModel.database = conn.database
  if (conn.connection_string) formModel.filePath = conn.connection_string
}

function initForm(driverType: DriverType) {
  const cfg = DRIVER_CONFIGS[driverType]
  const keys = Object.keys(formModel)
  for (const k of keys) {
    delete formModel[k]
  }
  for (const field of cfg.fields) {
    formModel[field.key] = field.defaultValue
  }
  formModel.name = cfg.connectionNameTemplate
}

function selectDriver(type: DriverType) {
  selectedDriver.value = type
  initForm(type)
  testResult.value = null
  testError.value = ''
}

function buildConfig(): ConnectionConfig {
  const options: Record<string, unknown> = {}
  if (formModel.charset) options.charset = formModel.charset
  if (formModel.sslmode) options.sslmode = formModel.sslmode

  const portValue = formModel.port
  const config = DRIVER_CONFIGS[selectedDriver.value]
  const defaultPort = config.defaultPort
  
  let port: number | undefined
  
  if (typeof portValue === 'number' && !isNaN(portValue) && portValue > 0 && portValue <= 65535) {
    port = Math.floor(portValue)
  } else if (defaultPort > 0) {
    port = defaultPort
  }

  const hostValue = (formModel.host as string) || 'localhost'

  return {
    driver_type: selectedDriver.value,
    host: hostValue || undefined,
    port,
    user: (formModel.user as string) || undefined,
    password: (formModel.password as string) || undefined,
    database: (formModel.database as string) || undefined,
    connection_string: selectedDriver.value === 'sqlite'
      ? (formModel.mode === 'memory' ? ':memory:' : (formModel.filePath as string) || undefined)
      : undefined,
    options,
  }
}

async function handleTestConnection() {
  testResult.value = null
  testError.value = ''
  try {
    const config = buildConfig()
    const result = await testConnectionApi(config)
    testResult.value = result
  } catch (err) {
    testError.value = parseConnectionError(err)
    testResult.value = { success: false, server_version: '', latency_ms: 0 }
  }
}

function parseConnectionError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    if (obj.message) {
      return String(obj.message)
    }
    if (obj.error) {
      return String(obj.error)
    }
  }
  if (typeof err === 'string') {
    try {
      const parsed = JSON.parse(err)
      if (parsed.message) {
        return String(parsed.message)
      }
      return err
    } catch {
      return err
    }
  }
  return String(err)
}

async function handleSave() {
  if (!formModel.name) return
  try {
    const config = buildConfig()
    
    if (props.connectionId) {
      await connect(config)
      connectionStore.updateConnection(props.connectionId, {
        name: (formModel.name as string) || 'Unnamed',
        host: (formModel.host as string) || undefined,
        port: (formModel.port as number) || undefined,
        user: (formModel.user as string) || undefined,
        username: (formModel.user as string) || undefined,
        database: (formModel.database as string) || undefined,
        driver_type: selectedDriver.value,
        connection_string: config.connection_string,
        options: config.options,
      })
    } else {
      const backendId = await connect(config)
      connectionStore.addConnection({
        id: backendId,
        name: (formModel.name as string) || 'Unnamed',
        host: (formModel.host as string) || undefined,
        port: (formModel.port as number) || undefined,
        user: (formModel.user as string) || undefined,
        username: (formModel.user as string) || undefined,
        database: (formModel.database as string) || undefined,
        driver_type: selectedDriver.value,
        connection_string: config.connection_string,
        options: config.options,
      })
      connectionStore.updateConnectionStatus(backendId, 'connected')
      connectionStore.setCurrentConnection(backendId)
    }
    emit('close')
  } catch (err) {
    console.error('Connection failed:', err)
  }
}
</script>

<style scoped>
.conn-dialog { display: flex; height: 420px; overflow: hidden; }
.conn-dialog-left { width: 140px; border-right: 1px solid var(--border-color, #e5e7eb); padding: 12px 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.driver-item { display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; transition: background-color 0.15s; border-radius: 0; }
.driver-item:hover { background-color: var(--hover-color, rgba(0, 0, 0, 0.04)); }
.driver-item.active { background-color: var(--primary-color-suppl, rgba(24, 160, 88, 0.1)); color: var(--primary-color, #18a058); font-weight: 500; }
.driver-name { font-size: 14px; }
.conn-dialog-right { flex: 1; padding: 12px 20px; overflow-y: auto; }
.test-result { padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
.test-result.success { background-color: rgba(24, 160, 88, 0.1); color: #18a058; }
.test-result.fail { background-color: rgba(208, 48, 80, 0.1); color: #d03050; }
.dialog-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--border-color, #e5e7eb); margin-top: 8px; }
</style>
