<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@linkbase/core'
import { NMessageProvider, NConfigProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui'
import { useAppStore } from '@linkbase/core/stores/app'
import { computed } from 'vue'
import MainLayout from './layouts/MainLayout.vue'

const { locale } = useI18n()
useTheme()

const appStore = useAppStore()
const isDark = computed(() => appStore.theme === 'dark')

watch(
  () => appStore.locale,
  (val) => { locale.value = val },
  { immediate: true },
)
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : undefined" :locale="appStore.locale === 'zh-CN' ? zhCN : undefined" :date-locale="appStore.locale === 'zh-CN' ? dateZhCN : undefined">
    <NMessageProvider>
      <MainLayout />
    </NMessageProvider>
  </NConfigProvider>
</template>
