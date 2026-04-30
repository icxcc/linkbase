<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NTooltip, NAlert } from 'naive-ui'
import { PlayOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@linkbase/core/stores/connection'

const { t } = useI18n()
const emit = defineEmits<{
  (e: 'execute', sql: string): void
}>()

const sql = ref('')
const connectionStore = useConnectionStore()

const activeConnectionName = computed(() => {
  const conn = connectionStore.connections.find((c) => c.id === connectionStore.currentConnectionId)
  return conn?.name ?? null
})

const canExecute = computed(() => !!activeConnectionName.value && sql.value.trim().length > 0)

function handleExecute() {
  if (!canExecute.value) return
  emit('execute', sql.value.trim())
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault()
    handleExecute()
  }
}

function handleFill(e: Event) {
  const detail = (e as CustomEvent).detail as string
  if (detail) sql.value = detail
}

onMounted(() => window.addEventListener('sql:fill', handleFill))
onUnmounted(() => window.removeEventListener('sql:fill', handleFill))
</script>

<template>
  <div class="sql-editor">
    <div class="sql-editor-toolbar">
      <div class="sql-editor-connection">
        <span v-if="activeConnectionName" class="connection-name">{{ activeConnectionName }}</span>
        <span v-else class="connection-none">{{ t('editor.notConnected') }}</span>
      </div>
      <NTooltip trigger="hover">
        <template #trigger>
          <NButton type="primary" size="small" :disabled="!canExecute" @click="handleExecute">
            <template #icon><NIcon><PlayOutline /></NIcon></template>
            {{ t('editor.execute') }}
          </NButton>
        </template>
        {{ t('editor.ctrlEnter') }}
      </NTooltip>
    </div>

    <NAlert v-if="!activeConnectionName" type="warning" :show-icon="false" class="sql-editor-warning">
      {{ t('editor.needConnection') }}
    </NAlert>

    <textarea
      v-model="sql"
      class="sql-textarea"
      :placeholder="t('editor.placeholder')"
      spellcheck="false"
      @keydown="handleKeydown"
    />
  </div>
</template>

<style scoped>
.sql-editor { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.sql-editor-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; border-bottom: 1px solid var(--lb-border-color);
  background-color: var(--lb-bg-secondary); min-height: 34px;
}
.sql-editor-connection { font-size: 12px; color: var(--lb-text-secondary); }
.connection-name { color: var(--lb-accent-color); font-weight: 600; }
.connection-none { color: var(--lb-text-secondary); font-style: italic; }
.sql-editor-warning { margin: 0; border-radius: 0; border-left: none; border-right: none; }
.sql-textarea {
  flex: 1; width: 100%; border: none; outline: none; resize: none;
  padding: 12px 16px; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 14px; line-height: 1.6; color: var(--lb-text-primary);
  background-color: var(--lb-bg-primary); tab-size: 2;
}
.sql-textarea::placeholder { color: var(--lb-text-secondary); opacity: 0.5; }
</style>
