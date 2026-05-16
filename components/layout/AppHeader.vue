<template>
  <nav class="h-13 flex items-center justify-between border-b border-border dark:border-dark-border px-4">
    <div class="font-bold text-primary">🔐 {{ $t('appTitle') }}</div>

    <div class="flex gap-1">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.id"
        :to="`/${tab.id}`"
        class="px-4 py-2 rounded transition hover:bg-accent dark:hover:bg-dark-accent"
        :class="{ 'text-primary font-semibold': currentTab === tab.id }"
      >
        {{ $t(tab.label) }}
      </NuxtLink>
    </div>

    <div class="flex items-center gap-2">
      <button
        @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
        class="p-2 rounded hover:bg-accent dark:hover:bg-dark-accent"
      >
        <Icon :name="colorMode.value === 'dark' ? 'mdi:moon' : 'mdi:sun'" />
      </button>
      <button
        @click="setLocale(locale === 'zh' ? 'en' : 'zh')"
        class="p-2 rounded hover:bg-accent dark:hover:bg-dark-accent"
      >
        <Icon name="mdi:translate" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const { locale, setLocale } = useI18n()
const route = useRoute()

const tabs = [
  { id: 'ca', label: 'caManager' },
  { id: 'certs', label: 'certManager' },
  { id: 'help', label: 'helpTab' }
]

const currentTab = computed(() => route.path.split('/').pop() || 'ca')
</script>
