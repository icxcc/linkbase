<script setup lang="ts">
import { ref } from 'vue'

interface MenuItem {
  key: string
  label: string
  icon?: string
  children?: MenuItem[]
  divider?: boolean
}

defineProps<{ 
  items: MenuItem[] 
  show: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{ 
  close: []
  select: [key: string]
}>()

const subMenuOpen = ref<string | null>(null)

function handleSelect(key: string) {
  emit('select', key)
}

function close() { 
  subMenuOpen.value = null
  emit('close')
}
</script>
<template>
  <Teleport to="body">
    <div v-if="show" class="l-context-overlay" @click="close" @contextmenu.prevent="close">
      <div class="l-context-menu" :style="{ left: x + 'px', top: y + 'px' }">
        <template v-for="item in items" :key="item.key || item.label">
          <div v-if="item.divider" class="l-context-divider" />
          <div v-else class="l-context-item" @click="handleSelect(item.key); close()" @mouseenter="subMenuOpen = item.children ? item.key || item.label : null" @mouseleave="subMenuOpen = null">
            {{ item.label }}
            <span v-if="item.children?.length">▸</span>
            <div v-if="item.children?.length && subMenuOpen === (item.key || item.label)" class="l-context-sub">
              <div v-for="child in item.children" :key="child.key || child.label" class="l-context-item" @click.stop="handleSelect(child.key); close()">{{ child.label }}</div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.l-context-overlay { position: fixed; inset: 0; z-index: 999; }
.l-context-menu { position: fixed; background: var(--lb-bg-primary); border: 1px solid var(--lb-border-color); border-radius: 6px; padding: 4px 0; min-width: 160px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.l-context-item { padding: 6px 12px; cursor: pointer; font-size: 13px; color: var(--lb-text-primary); display: flex; justify-content: space-between; align-items: center; position: relative; }
.l-context-item:hover { background: var(--lb-hover-bg); }
.l-context-divider { height: 1px; background: var(--lb-border-color); margin: 4px 0; }
.l-context-sub { position: absolute; left: 100%; top: -4px; background: var(--lb-bg-primary); border: 1px solid var(--lb-border-color); border-radius: 6px; padding: 4px 0; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
</style>
