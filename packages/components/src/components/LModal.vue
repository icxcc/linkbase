<script setup lang="ts">
defineProps<{ show: boolean; title?: string }>()
defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>()
</script>
<template>
  <Teleport to="body">
    <div v-if="show" class="l-modal-overlay" @click.self="$emit('close')">
      <div class="l-modal">
        <div class="l-modal-header">
          <span class="l-modal-title">{{ title }}</span>
          <button class="l-modal-close" @click="$emit('close')">✕</button>
        </div>
        <div class="l-modal-body"><slot /></div>
        <div v-if="$slots.footer" class="l-modal-footer"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.l-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.l-modal { background: var(--lb-bg-primary); border: 1px solid var(--lb-border-color); border-radius: 8px; min-width: 400px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
.l-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--lb-border-color); }
.l-modal-title { font-size: 15px; font-weight: 600; color: var(--lb-text-primary); }
.l-modal-close { border: none; background: none; cursor: pointer; color: var(--lb-text-secondary); font-size: 16px; }
.l-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.l-modal-footer { padding: 12px 20px; border-top: 1px solid var(--lb-border-color); display: flex; justify-content: flex-end; gap: 8px; }
</style>
