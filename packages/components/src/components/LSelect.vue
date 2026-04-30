<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  options: { label: string; value: string }[]
  placeholder?: string
  searchable?: boolean
}>()
const model = defineModel<string>({ default: '' })
const show = ref(false)
const search = ref('')

const filtered = computed(() => {
  if (!props.searchable || !search.value) return props.options
  return props.options.filter((o) => o.label.toLowerCase().includes(search.value.toLowerCase()))
})
function select(value: string) { model.value = value; show.value = false; search.value = '' }
const selectedLabel = computed(() => props.options.find((o) => o.value === model.value)?.label ?? props.placeholder ?? '')
</script>
<template>
  <div class="l-select" tabindex="0" @blur="show = false">
    <div class="l-select-trigger" @click="show = !show">
      <span :class="{ 'l-select-placeholder': !model }">{{ selectedLabel }}</span>
      <span class="l-select-arrow">▾</span>
    </div>
    <div v-if="show" class="l-select-dropdown">
      <input v-if="searchable" v-model="search" class="l-select-search" placeholder="搜索..." @click.stop />
      <div v-for="opt in filtered" :key="opt.value" class="l-select-option" :class="{ 'l-select-option--active': model === opt.value }" @click.stop="select(opt.value)">{{ opt.label }}</div>
      <div v-if="filtered.length === 0" class="l-select-empty">无匹配选项</div>
    </div>
  </div>
</template>
<style scoped>
.l-select { position: relative; }
.l-select-trigger { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border: 1px solid var(--lb-border-color); border-radius: 6px; cursor: pointer; background: var(--lb-bg-primary); color: var(--lb-text-primary); font-size: 13px; min-width: 120px; }
.l-select-placeholder { color: var(--lb-text-secondary); opacity: 0.5; }
.l-select-arrow { font-size: 10px; color: var(--lb-text-secondary); }
.l-select-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: var(--lb-bg-primary); border: 1px solid var(--lb-border-color); border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.l-select-search { width: 100%; border: none; border-bottom: 1px solid var(--lb-border-color); padding: 8px 10px; outline: none; background: transparent; color: var(--lb-text-primary); font-size: 13px; box-sizing: border-box; }
.l-select-option { padding: 6px 10px; cursor: pointer; font-size: 13px; color: var(--lb-text-primary); }
.l-select-option:hover { background: var(--lb-hover-bg); }
.l-select-option--active { color: var(--lb-accent-color); }
.l-select-empty { padding: 8px 10px; font-size: 12px; color: var(--lb-text-secondary); }
</style>
