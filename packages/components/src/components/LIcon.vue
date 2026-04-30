<script setup lang="ts">
defineProps<{ name: string; size?: number; color?: string }>()
</script>
<template>
  <span class="l-icon" :style="{ fontSize: (size ?? 16) + 'px', color }">{{ name }}</span>
</template>
<style scoped>
.l-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
</style>
