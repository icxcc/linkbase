<script setup lang="ts">
/**
 * DangerousSqlDialog - placeholder component for dangerous SQL confirmation.
 * Currently exports an empty shell to satisfy the index.ts export.
 */
import { defineProps, defineEmits } from 'vue'

defineProps<{ show?: boolean; sql?: string }>()
defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'confirm'): void }>()
</script>

<template>
  <!-- Dangerous SQL dialog placeholder - to be implemented -->
  <div v-if="false" />
</template>
