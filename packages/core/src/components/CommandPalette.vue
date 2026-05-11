<script setup lang="ts">
/**
 * CommandPalette - placeholder component for future command palette feature.
 * Currently exports an empty shell to satisfy the index.ts export.
 */
import { defineProps, defineEmits } from 'vue'

defineProps<{ show?: boolean }>()
defineEmits<{ (e: 'update:show', v: boolean): void }>()
</script>

<template>
  <!-- Command palette placeholder - to be implemented -->
  <div v-if="false" />
</template>
