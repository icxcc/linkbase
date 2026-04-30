<script setup lang="ts">
defineProps<{
  type?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
  disabled?: boolean
}>()
defineEmits<{ (e: 'click'): void }>()
</script>
<template>
  <button
    class="l-button"
    :class="[`l-button--${type ?? 'secondary'}`, `l-button--${size ?? 'medium'}`]"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <span v-if="loading" class="l-button-spinner" />
    <slot />
  </button>
</template>
<style scoped>
.l-button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--lb-border-color); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s; background: var(--lb-bg-secondary); color: var(--lb-text-primary); }
.l-button:hover:not(:disabled) { background: var(--lb-hover-bg); }
.l-button:disabled { opacity: 0.5; cursor: not-allowed; }
.l-button--small { padding: 4px 10px; font-size: 12px; }
.l-button--medium { padding: 6px 14px; }
.l-button--large { padding: 8px 18px; font-size: 14px; }
.l-button--primary { background: var(--lb-accent-color); color: #fff; border-color: var(--lb-accent-color); }
.l-button--primary:hover:not(:disabled) { opacity: 0.85; }
.l-button--danger { color: #e74c3c; border-color: #e74c3c; }
.l-button--danger:hover:not(:disabled) { background: #e74c3c; color: #fff; }
.l-button--ghost { background: transparent; border-color: transparent; }
.l-button-spinner { width: 12px; height: 12px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: l-spin 0.6s linear infinite; display: inline-block; }
@keyframes l-spin { to { transform: rotate(360deg); } }
</style>
