<template>
  <div class="flex h-full">
    <!-- 左侧 CA 列表 -->
    <aside class="w-64 border-r border-border dark:border-dark-border bg-card dark:bg-dark-card">
      <div class="p-4 border-b border-border dark:border-dark-border flex justify-between items-center">
        <h3 class="font-semibold">{{ $t('caList') }}</h3>
        <button
          @click="showCreateModal = true"
          class="text-primary text-sm hover:underline"
        >
          {{ $t('newCA') }}
        </button>
      </div>
      <div v-if="caStore.loading" class="p-4 text-textMuted dark:text-dark-textMuted text-center">
        {{ $t('loading') }}
      </div>
      <div v-else-if="caStore.cas.length === 0" class="p-4 text-textMuted dark:text-dark-textMuted text-center">
        {{ $t('noCAs') }}
      </div>
      <div v-else class="overflow-y-auto p-2 space-y-1">
        <div
          v-for="ca in caStore.cas"
          :key="ca.name"
          @click="caStore.select(ca.name)"
          class="p-3 rounded cursor-pointer hover:bg-accent dark:hover:bg-dark-accent transition"
          :class="{
            'bg-activeBg dark:bg-dark-activeBg border-l-2 border-primary': caStore.currentCA === ca.name
          }"
        >
          <div class="font-medium">{{ ca.name }}</div>
          <div class="text-sm text-textMuted dark:text-dark-textMuted truncate">{{ ca.subject }}</div>
          <div class="text-xs text-textDim dark:text-dark-textDim">
            {{ $t('expires') }}: {{ formatDate(ca.notAfter) }}
          </div>
          <div v-if="ca.certCount !== undefined" class="text-xs text-primary font-medium mt-1">
            {{ ca.certCount }} cert(s)
          </div>
        </div>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <section class="flex-1 overflow-y-auto p-6">
      <CACaWelcome v-if="!caStore.currentCA" @create="showCreateModal = true" />
      <CACaDetail v-else :ca-name="caStore.currentCA" />
    </section>
  </div>

  <CACreateModal v-if="showCreateModal" @close="showCreateModal = false" />
</template>

<script setup lang="ts">
const caStore = useCAStore()
const showCreateModal = ref(false)

onMounted(() => caStore.fetchAll())

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString()
}
</script>
