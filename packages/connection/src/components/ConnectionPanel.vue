<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NInput, NSelect, NList, NListItem, NThing,
  NSpace, NTag, NModal, NForm, NFormItem, NRadioGroup, NRadio, NIcon,
  NCheckbox, NDropdown, NSpin,
  useMessage,
} from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import {
  AddOutline, TrashOutline, LinkOutline, UnlinkOutline,
  ServerOutline, DocumentOutline, FolderOutline, FolderOpenOutline,
  CloudDownloadOutline, CloudUploadOutline, CheckmarkCircleOutline,
  CloseCircleOutline, ChevronDownOutline, ChevronForwardOutline,
} from '@vicons/ionicons5'
import { useConnectionStore, type Connection } from '@linkbase/core/stores/connection'
import { connect, disconnect, testConnection, extractErrorMessage, type ConnectionConfig, type TestResult } from '@linkbase/core/api'

const { t } = useI18n()
const emit = defineEmits<{
  (e: 'connection-changed', id: string | null): void
}>()

const message = useMessage()
const store = useConnectionStore()

const showModal = ref(false)
const isSubmitting = ref(false)
const isTesting = ref(false)
const testResult = ref<TestResult | null>(null)
const collapsedFolders = ref<Set<string>>(new Set())
const fileInputRef = ref<HTMLInputElement>()

interface FormModel {
  name: string
  driver_type: 'sqlite' | 'mysql' | 'postgres'
  sqliteMode: 'memory' | 'file'
  filePath: string
  host: string
  port: number
  user: string
  password: string
  database: string
  sslmode: string
}

const defaultForm = (): FormModel => ({
  name: '',
  driver_type: 'sqlite',
  sqliteMode: 'memory',
  filePath: '',
  host: 'localhost',
  port: 3306,
  user: '',
  password: '',
  database: '',
  sslmode: 'prefer',
})

const formModel = ref<FormModel>(defaultForm())
const portText = ref('')

const driverOptions = [
  { label: 'SQLite', value: 'sqlite' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgres' },
]

const sslmodeOptions = [
  { label: 'disable', value: 'disable' },
  { label: 'prefer', value: 'prefer' },
  { label: 'require', value: 'require' },
  { label: 'verify-ca', value: 'verify-ca' },
  { label: 'verify-full', value: 'verify-full' },
]

function onDriverTypeChange(val: 'sqlite' | 'mysql' | 'postgres') {
  testResult.value = null
  if (val === 'mysql') { formModel.value.port = 3306; portText.value = '3306' }
  else if (val === 'postgres') { formModel.value.port = 5432; portText.value = '5432' }
}

watch(() => formModel.value.driver_type, () => {
  testResult.value = null
})

interface ContextMenuState {
  show: boolean
  x: number
  y: number
  type: 'folder' | 'connection' | 'panel'
  folderId?: string
  connectionId?: string
}

const contextMenu = ref<ContextMenuState>({
  show: false, x: 0, y: 0, type: 'panel',
})

const contextMenuOptions = computed<DropdownOption[]>(() => {
  if (contextMenu.value.type === 'folder') {
    return [
      { label: '重命名', key: 'rename-folder' },
      { label: '删除文件夹', key: 'delete-folder' },
    ]
  }
  if (contextMenu.value.type === 'connection') {
    const folderItems: DropdownOption[] = [
      { label: '无文件夹', key: `move:__none__` },
      ...store.folders.map((f) => ({ label: f.name, key: `move:${f.id}` })),
    ]
    return [
      { label: '移动到文件夹', key: 'move-header', children: folderItems },
      { type: 'divider' },
      { label: '删除连接', key: 'delete-connection' },
    ]
  }
  return [
    { label: '新建文件夹', key: 'new-folder' },
  ]
})

function openModal() {
  formModel.value = defaultForm()
  portText.value = '3306'
  testResult.value = null
  showModal.value = true
}

function syncPort() {
  const n = parseInt(portText.value, 10)
  if (!isNaN(n) && n > 0) formModel.value.port = n
}

function buildConfig(): ConnectionConfig {
  syncPort()
  const fm = formModel.value
  if (fm.driver_type === 'sqlite') {
    const connStr = fm.sqliteMode === 'memory' ? ':memory:' : fm.filePath.trim()
    return { driver_type: 'sqlite', connection_string: connStr, options: {} }
  }
  if (fm.driver_type === 'mysql') {
    const port = fm.port || 3306
    const pwd = fm.password ? `:${encodeURIComponent(fm.password)}` : ''
    return {
      driver_type: 'mysql',
      connection_string: `mysql://${fm.user}${pwd}@${fm.host}:${port}/${fm.database}`,
      options: {},
    }
  }
  const pgPort = fm.port || 5432
  const pgPwd = fm.password ? `:${encodeURIComponent(fm.password)}` : ''
  return {
    driver_type: 'postgres',
    connection_string: `postgres://${fm.user}${pgPwd}@${fm.host}:${pgPort}/${fm.database}?sslmode=${fm.sslmode}`,
    options: {},
  }
}

function connectionSubtitle(conn: Connection): string {
  if (conn.driver_type === 'sqlite') return conn.connection_string
  const parts: string[] = []
  if (conn.host) {
    parts.push(`${conn.host}:${conn.port}`)
  }
  if (conn.database) {
    parts.push(`/${conn.database}`)
  }
  return parts.join('') || conn.driver_type
}

async function handleTestConnection() {
  if (!formModel.value.name.trim()) {
    message.error('请输入连接名称')
    return
  }
  isTesting.value = true
  testResult.value = null
  try {
    const config = buildConfig()
    const result = await testConnection(config)
    testResult.value = result
  } catch (err: unknown) {
    testResult.value = { success: false, latency_ms: 0, server_version: '', ssl_status: '', driver_info: extractErrorMessage(err) }
  } finally {
    isTesting.value = false
  }
}

async function handleSave() {
  if (!formModel.value.name.trim()) {
    message.error('请输入连接名称')
    return
  }
  if (formModel.value.driver_type === 'sqlite' && formModel.value.sqliteMode === 'file' && !formModel.value.filePath.trim()) {
    message.error('请输入文件路径')
    return
  }

  isSubmitting.value = true
  try {
    const config = buildConfig()
    const backendId = await connect(config)
    const fm = formModel.value
    store.addConnection({
      id: backendId,
      name: fm.name.trim(),
      host: fm.driver_type === 'sqlite' ? config.connection_string : fm.host,
      port: fm.port,
      database: fm.database || undefined,
      username: fm.user || undefined,
      driver_type: fm.driver_type,
      connection_string: config.connection_string,
      options: config.options,
    })
    store.updateConnectionStatus(backendId, 'connected')
    store.setCurrentConnection(backendId)
    emit('connection-changed', backendId)
    message.success('连接成功')
    showModal.value = false
  } catch (err: unknown) {
    message.error(extractErrorMessage(err))
  } finally {
    isSubmitting.value = false
  }
}

async function handleConnect(conn: Connection) {
  store.updateConnectionStatus(conn.id, 'connecting')
  try {
    const config: ConnectionConfig = {
      driver_type: conn.driver_type,
      connection_string: conn.connection_string,
      options: conn.options,
    }
    const backendId = await connect(config)
    if (backendId !== conn.id) {
      store.removeConnection(conn.id)
      store.addConnection({
        id: backendId,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username,
        driver_type: conn.driver_type,
        connection_string: conn.connection_string,
        options: conn.options,
        folderId: conn.folderId,
      })
      store.updateConnectionStatus(backendId, 'connected')
      store.setCurrentConnection(backendId)
      emit('connection-changed', backendId)
    } else {
      store.updateConnectionStatus(conn.id, 'connected')
      store.setCurrentConnection(conn.id)
      emit('connection-changed', conn.id)
    }
    message.success('连接成功')
  } catch (err: unknown) {
    store.updateConnectionStatus(conn.id, 'error')
    message.error(extractErrorMessage(err))
  }
}

async function handleDisconnect(conn: Connection) {
  try {
    await disconnect(conn.id)
    store.updateConnectionStatus(conn.id, 'disconnected')
    message.success('已断开连接')
  } catch (err: unknown) {
    message.error(extractErrorMessage(err))
  }
}

function handleDelete(conn: Connection) {
  store.removeConnection(conn.id)
  if (store.currentConnectionId === conn.id) {
    emit('connection-changed', null)
  }
  message.success('已删除连接')
}

function statusTagType(status: string): 'success' | 'default' | 'error' | 'warning' | 'info' {
  switch (status) {
    case 'connected': return 'success'
    case 'error': return 'error'
    case 'connecting':
    case 'reconnecting': return 'warning'
    default: return 'default'
  }
}

function statusText(status: string): string {
  switch (status) {
    case 'connected': return '已连接'
    case 'disconnected': return '未连接'
    case 'connecting': return '连接中'
    case 'reconnecting': return '重连中'
    case 'error': return '错误'
    default: return '空闲'
  }
}

function isConnecting(conn: Connection): boolean {
  return conn.status === 'connecting' || conn.status === 'reconnecting'
}

function toggleFolder(folderId: string) {
  const s = new Set(collapsedFolders.value)
  if (s.has(folderId)) s.delete(folderId)
  else s.add(folderId)
  collapsedFolders.value = s
}

function isFolderCollapsed(folderId: string): boolean {
  return collapsedFolders.value.has(folderId)
}

function onPanelContextMenu(e: MouseEvent) {
  e.preventDefault()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, type: 'panel' }
}

function onFolderContextMenu(e: MouseEvent, folderId: string) {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, type: 'folder', folderId }
}

function onConnectionContextMenu(e: MouseEvent, connectionId: string) {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, type: 'connection', connectionId }
}

function handleContextMenuSelect(key: string) {
  contextMenu.value.show = false
  if (key === 'new-folder') {
    handleAddFolder()
  } else if (key === 'rename-folder' && contextMenu.value.folderId) {
    handleRenameFolder(contextMenu.value.folderId)
  } else if (key === 'delete-folder' && contextMenu.value.folderId) {
    handleDeleteFolder(contextMenu.value.folderId)
  } else if (key === 'delete-connection' && contextMenu.value.connectionId) {
    const conn = store.connections.find((c) => c.id === contextMenu.value.connectionId)
    if (conn) handleDelete(conn)
  } else if (key.startsWith('move:') && contextMenu.value.connectionId) {
    const folderId = key.slice(5)
    store.moveToFolder(contextMenu.value.connectionId, folderId === '__none__' ? undefined : folderId)
  }
}

function handleAddFolder() {
  const name = window.prompt('文件夹名称：')
  if (name && name.trim()) {
    store.addFolder(name.trim())
  }
}

function handleRenameFolder(folderId: string) {
  const folder = store.folders.find((f) => f.id === folderId)
  if (!folder) return
  const name = window.prompt('新名称：', folder.name)
  if (name && name.trim()) {
    store.renameFolder(folderId, name.trim())
  }
}

function handleDeleteFolder(folderId: string) {
  store.removeFolder(folderId)
  message.success('已删除文件夹')
}

function exportConnections() {
  const data = store.connections.map((c) => ({
    name: c.name,
    driver_type: c.driver_type,
    host: c.host,
    port: c.port,
    database: c.database,
    username: c.username,
    connection_string: c.connection_string,
    options: c.options,
    folderId: c.folderId,
  }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'linkbase-connections.json'
  a.click()
  URL.revokeObjectURL(url)
  message.warning('导出的连接信息中可能包含密码，请注意安全保管')
}

function triggerImport() {
  fileInputRef.value?.click()
}

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string)
      if (!Array.isArray(data)) {
        message.error('导入失败：JSON 文件格式不正确，需要连接数组')
        return
      }
      let added = 0
      let conflicts = 0
      for (const item of data) {
        if (!item.name) continue
        const exists = store.connections.some((c) => c.name === item.name)
        if (exists) {
          conflicts++
          continue
        }
        store.addConnection({
          id: crypto.randomUUID?.() ?? `import-${Date.now()}-${added}`,
          name: item.name,
          host: item.host || '',
          port: item.port || 0,
          database: item.database,
          username: item.username,
          driver_type: item.driver_type || 'sqlite',
          connection_string: item.connection_string || '',
          options: item.options,
          folderId: item.folderId,
        })
        added++
      }
      if (added > 0) {
        message.success(`导入完成：${added} 个连接${conflicts > 0 ? `，${conflicts} 个名称冲突已跳过` : ''}`)
      } else if (conflicts > 0) {
        message.warning(`所有 ${conflicts} 个连接均存在名称冲突，已跳过`)
      } else {
        message.warning('未找到有效的连接数据')
      }
    } catch {
      message.error('导入失败：无效的 JSON 文件')
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div class="connection-panel" @contextmenu="onPanelContextMenu">
    <div class="connection-header">
      <span class="connection-title">{{ t('connection.connections') }}</span>
      <NSpace size="small">
        <NCheckbox v-model:checked="store.autoReconnect" size="small">
          <span style="font-size:11px">自动重连</span>
        </NCheckbox>
      </NSpace>
      <NSpace size="small">
        <NButton size="tiny" quaternary title="导入" @click="triggerImport">
          <template #icon><NIcon size="14"><CloudUploadOutline /></NIcon></template>
        </NButton>
        <NButton size="tiny" quaternary title="导出" @click="exportConnections">
          <template #icon><NIcon size="14"><CloudDownloadOutline /></NIcon></template>
        </NButton>
        <NButton size="tiny" quaternary title="新建文件夹" @click="handleAddFolder">
          <template #icon><NIcon size="14"><FolderOutline /></NIcon></template>
        </NButton>
        <NButton size="tiny" @click="openModal">
          <template #icon><NIcon size="14"><AddOutline /></NIcon></template>
        </NButton>
      </NSpace>
    </div>

    <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="handleImport" />

    <div v-if="store.connections.length === 0 && store.folders.length === 0" class="empty-state">
      <NIcon size="24" :depth="3"><DocumentOutline /></NIcon>
      <span>暂无连接</span>
      <span class="empty-hint">右键或点击 + 添加连接</span>
    </div>

    <template v-for="group in store.connectionsByFolder" :key="group.folder?.id ?? '__ungrouped__'">
      <div
        v-if="group.folder"
        class="folder-header"
        @contextmenu="onFolderContextMenu($event, group.folder.id)"
        @click="toggleFolder(group.folder.id)"
      >
        <NIcon size="14">
          <ChevronForwardOutline v-if="isFolderCollapsed(group.folder.id)" />
          <ChevronDownOutline v-else />
        </NIcon>
        <NIcon size="14">
          <FolderOpenOutline v-if="!isFolderCollapsed(group.folder.id)" />
          <FolderOutline v-else />
        </NIcon>
        <span class="folder-name">{{ group.folder.name }}</span>
        <span class="folder-count">{{ group.connections.length }}</span>
      </div>

      <NList
        v-if="!group.folder || !isFolderCollapsed(group.folder.id)"
        class="conn-list"
      >
        <NListItem
          v-for="conn in group.connections"
          :key="conn.id"
          @contextmenu="onConnectionContextMenu($event, conn.id)"
        >
          <NThing>
            <template #header>
              <NSpace align="center" size="small">
                <NIcon size="14"><ServerOutline /></NIcon>
                <span class="conn-name">{{ conn.name }}</span>
                <NSpin :size="12" v-if="isConnecting(conn)" />
                <NTag :type="statusTagType(conn.status)" size="small" :bordered="false">
                  {{ statusText(conn.status) }}
                </NTag>
              </NSpace>
            </template>
            <template #description>
              <span class="conn-meta">{{ connectionSubtitle(conn) }}</span>
            </template>
            <template #action>
              <NSpace size="small">
                <NButton
                  v-if="conn.status !== 'connected'"
                  size="tiny"
                  quaternary
                  :disabled="isConnecting(conn)"
                  @click="handleConnect(conn)"
                >
                  <template #icon><NIcon size="14"><LinkOutline /></NIcon></template>
                </NButton>
                <NButton v-else size="tiny" quaternary @click="handleDisconnect(conn)">
                  <template #icon><NIcon size="14"><UnlinkOutline /></NIcon></template>
                </NButton>
                <NButton size="tiny" quaternary type="error" @click="handleDelete(conn)">
                  <template #icon><NIcon size="14"><TrashOutline /></NIcon></template>
                </NButton>
              </NSpace>
            </template>
          </NThing>
        </NListItem>
      </NList>
    </template>

    <NModal
      v-model:show="showModal"
      title="新建连接"
      preset="card"
      style="width: 520px"
      :mask-closable="false"
    >
      <NForm label-placement="left" label-width="100px">
        <NFormItem label="连接名称">
          <NInput v-model:value="formModel.name" placeholder="输入连接名称" />
        </NFormItem>
        <NFormItem label="驱动类型">
          <NSelect v-model:value="formModel.driver_type" :options="driverOptions" @update:value="onDriverTypeChange" />
        </NFormItem>

        <template v-if="formModel.driver_type === 'sqlite'">
          <NFormItem label="模式">
            <NRadioGroup v-model:value="formModel.sqliteMode">
              <NSpace>
                <NRadio value="memory">内存数据库</NRadio>
                <NRadio value="file">文件数据库</NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>
          <NFormItem v-if="formModel.sqliteMode === 'file'" label="文件路径">
            <NInput v-model:value="formModel.filePath" placeholder="输入 SQLite 文件路径" />
          </NFormItem>
        </template>

        <template v-if="formModel.driver_type === 'mysql' || formModel.driver_type === 'postgres'">
          <NFormItem label="主机">
            <NInput v-model:value="formModel.host" placeholder="localhost" />
          </NFormItem>
          <NFormItem label="端口">
            <NInput v-model:value="portText" placeholder="端口号" />
          </NFormItem>
          <NFormItem label="用户名">
            <NInput v-model:value="formModel.user" placeholder="用户名" />
          </NFormItem>
          <NFormItem label="密码">
            <NInput v-model:value="formModel.password" type="password" placeholder="密码" />
          </NFormItem>
          <NFormItem label="数据库">
            <NInput v-model:value="formModel.database" placeholder="数据库名" />
          </NFormItem>
        </template>

        <template v-if="formModel.driver_type === 'postgres'">
          <NFormItem label="SSL 模式">
            <NSelect v-model:value="formModel.sslmode" :options="sslmodeOptions" />
          </NFormItem>
        </template>
      </NForm>

      <div v-if="testResult" class="test-result" :class="testResult.success ? 'test-success' : 'test-error'">
        <NSpace align="center" size="small">
          <NIcon size="16">
            <CheckmarkCircleOutline v-if="testResult.success" />
            <CloseCircleOutline v-else />
          </NIcon>
          <span v-if="testResult.success">{{ testResult.server_version }}</span>
          <span v-else>{{ testResult.driver_info }}</span>
          <span v-if="testResult.latency_ms !== undefined" class="test-latency">
            ({{ testResult.latency_ms }}ms)
          </span>
        </NSpace>
      </div>

      <template #footer>
        <NSpace justify="space-between" style="width:100%">
          <NButton @click="handleTestConnection" :loading="isTesting" secondary>
            测试连接
          </NButton>
          <NSpace>
            <NButton @click="showModal = false">取消</NButton>
            <NButton type="primary" :loading="isSubmitting" @click="handleSave">
              保存并连接
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NModal>

    <NDropdown
      trigger="manual"
      :show="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="contextMenuOptions"
      @select="handleContextMenuSelect"
      @clickoutside="contextMenu.show = false"
    />
  </div>
</template>

<style scoped>
.connection-panel {
  padding: 10px 12px;
  overflow-y: auto;
  flex-shrink: 0;
  max-height: 40%;
  user-select: none;
}

.connection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 4px;
}

.connection-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--lb-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.conn-list {
  margin: 0 -12px;
}

.conn-name {
  font-size: 13px;
  font-weight: 500;
}

.conn-meta {
  font-size: 11px;
  color: var(--lb-text-secondary);
  word-break: break-all;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  gap: 8px;
  color: var(--lb-text-secondary);
  font-size: 12px;
}

.empty-hint {
  font-size: 11px;
  opacity: 0.6;
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  margin: 4px 0 0;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  color: var(--lb-text-secondary);
  transition: background-color 0.15s;
}

.folder-header:hover {
  background-color: var(--lb-bg-hover, rgba(128, 128, 128, 0.1));
}

.folder-name {
  flex: 1;
  font-weight: 500;
}

.folder-count {
  font-size: 10px;
  opacity: 0.5;
}

.test-result {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.test-success {
  background-color: rgba(24, 160, 88, 0.1);
  color: #18a058;
}

.test-error {
  background-color: rgba(208, 48, 80, 0.1);
  color: #d03050;
}

.test-latency {
  font-size: 11px;
  opacity: 0.7;
}
</style>
