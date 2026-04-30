<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ text: string; position?: 'top' | 'bottom' | 'left' | 'right' }>()
const show = ref(false)
</script>
<template>
  <div class="l-tooltip-wrapper" @mouseenter="show = true" @mouseleave="show = false">
    <slot />
    <Teleport to="body">
      <div v-if="show" class="l-tooltip" :class="`l-tooltip--${position ?? 'top'}`">{{ text }}</div>
    </Teleport>
  </div>
</template>
<style scoped>
.l-tooltip-wrapper { display: inline-block; position: relative; }
.l-tooltip { position: fixed; background: var(--lb-text-primary); color: var(--lb-bg-primary); padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; z-index: 1001; pointer-events: none; }
</style>
