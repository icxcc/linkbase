<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
const props = withDefaults(defineProps<{
  direction?: 'horizontal' | 'vertical'
  initialSize?: number
  minSize?: number
  maxSize?: number
}>(), { direction: 'horizontal', initialSize: 250, minSize: 120, maxSize: 500 })

const size = ref(props.initialSize)
const dragging = ref(false)
let startPos = 0
let startSize = 0

function onMouseDown(e: MouseEvent) {
  dragging.value = true
  startPos = props.direction === 'horizontal' ? e.clientX : e.clientY
  startSize = size.value
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  const delta = (props.direction === 'horizontal' ? e.clientX : e.clientY) - startPos
  size.value = Math.max(props.minSize, Math.min(props.maxSize, startSize + delta))
}
function onMouseUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}
onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>
<template>
  <div class="l-split" :class="`l-split--${direction}`">
    <div class="l-split-pane" :style="direction === 'horizontal' ? { width: size + 'px' } : { height: size + 'px' }">
      <slot name="first" />
    </div>
    <div class="l-split-handle" :class="{ 'l-split-handle--dragging': dragging }" @mousedown="onMouseDown" />
    <div class="l-split-pane l-split-pane--flex">
      <slot name="second" />
    </div>
  </div>
</template>
<style scoped>
.l-split { display: flex; overflow: hidden; }
.l-split--horizontal { flex-direction: row; }
.l-split--vertical { flex-direction: column; }
.l-split-pane { overflow: hidden; flex-shrink: 0; }
.l-split-pane--flex { flex: 1; min-width: 0; min-height: 0; }
.l-split-handle { background: var(--lb-border-color); transition: background 0.15s; flex-shrink: 0; }
.l-split--horizontal .l-split-handle { width: 3px; cursor: col-resize; }
.l-split--vertical .l-split-handle { height: 3px; cursor: row-resize; }
.l-split-handle:hover, .l-split-handle--dragging { background: var(--lb-accent-color); }
</style>
