<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NTabs, NTabPane, NSpin, NEmpty, NIcon } from 'naive-ui'
import { CheckmarkOutline } from '@vicons/ionicons5'
import HistoryPanel from './HistoryPanel.vue'
import LVirtualTable from './LVirtualTable.vue'

const { t } = useI18n()

interface Props {
  columns?: string[]
  data?: unknown[][]
  loading?: boolean
  error?: string | null
  executionTime?: number
  affectedRows?: number
}

const props = withDefaults(defineProps<Props>(), {
  columns: () => [],
  data: () => [],
  loading: false,
  error: null,
  executionTime: undefined,
  affectedRows: undefined,
})

const hasRowsResult = computed(() => props.columns.length > 0 || props.data.length > 0)
const hasModification = computed(() => props.affectedRows !== undefined && !hasRowsResult.value)

const executionInfo = computed(() => {
  const parts: string[] = []
  if (props.affectedRows !== undefined) {
    parts.push(t('result.rowsAffected', { n: props.affectedRows }))
  }
  if (props.executionTime !== undefined) {
    parts.push(`${props.executionTime.toFixed(1)}ms`)
  }
  return parts.join(' | ')
})

const activeTab = computed(() => (hasModification.value || !hasRowsResult.value ? 'messages' : 'results'))
</script>

<template>
  <div class="result-panel">
    <NAlert v-if="error" type="error" :show-icon="true" class="result-error">
      {{ error }}
    </NAlert>

    <NSpin v-if="loading" class="result-loading" />

    <NTabs v-else :default-value="activeTab" type="line" class="result-tabs">
      <NTabPane name="results" :tab="t('result.results')">
        <LVirtualTable
          v-if="hasRowsResult"
          :columns="columns"
          :rows="data"
          class="result-table"
        />
        <div v-else-if="hasModification || executionInfo" class="result-success">
          <NIcon size="20" color="var(--lb-accent-color)"><CheckmarkOutline /></NIcon>
          <span>{{ t('result.successLabel') + executionInfo }}</span>
        </div>
        <NEmpty v-else :description="t('result.empty')" />
      </NTabPane>
      <NTabPane name="messages" :tab="t('result.messages')">
        <div class="result-messages">
          <p v-if="executionInfo">{{ executionInfo }}</p>
          <p v-else>{{ t('result.noMessages') }}</p>
        </div>
      </NTabPane>
      <NTabPane name="history" tab="历史">
        <HistoryPanel />
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.result-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.result-error { margin: 8px 12px 0; flex-shrink: 0; }
.result-loading { display: flex; align-items: center; justify-content: center; flex: 1; }
.result-tabs { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.result-tabs :deep(.n-tabs-nav) { flex-shrink: 0; }
.result-tabs :deep(.n-tab-pane) { height: 100%; overflow: auto; }
.result-table { height: 100%; }
.result-success {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 12px; color: var(--lb-text-secondary); font-size: 14px;
}
.result-messages { padding: 16px; font-size: 13px; color: var(--lb-text-secondary); font-family: monospace; }
.result-empty { display: flex; align-items: center; justify-content: center; flex: 1; }
</style>
