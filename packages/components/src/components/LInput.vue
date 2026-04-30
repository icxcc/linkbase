<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{
  placeholder?: string
  type?: 'text' | 'password'
  clearable?: boolean
  size?: 'small' | 'medium'
  disabled?: boolean
}>()
</script>
<template>
  <div class="l-input-wrapper" :class="`l-input--${size ?? 'medium'}`">
    <slot name="prefix" />
    <input
      v-model="model"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :disabled="disabled"
      class="l-input"
    />
    <button v-if="clearable && model" class="l-input-clear" @click="model = ''">✕</button>
    <slot name="suffix" />
  </div>
</template>
<style scoped>
.l-input-wrapper { display: flex; align-items: center; border: 1px solid var(--lb-border-color); border-radius: 6px; background: var(--lb-bg-primary); transition: border-color 0.15s; }
.l-input-wrapper:focus-within { border-color: var(--lb-accent-color); }
.l-input--small { padding: 2px 8px; }
.l-input--medium { padding: 4px 10px; }
.l-input { flex: 1; border: none; outline: none; background: transparent; color: var(--lb-text-primary); font-size: 13px; font-family: inherit; }
.l-input::placeholder { color: var(--lb-text-secondary); opacity: 0.5; }
.l-input-clear { border: none; background: none; cursor: pointer; color: var(--lb-text-secondary); font-size: 12px; padding: 0 2px; }
</style>
