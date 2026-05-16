<template>
  <div class="text-center py-20">
    <div class="bg-card dark:bg-dark-card rounded-lg p-12 max-w-lg mx-auto shadow-lg">
      <div class="text-6xl mb-6">🔐</div>
      <h2 class="text-2xl font-bold mb-4">{{ $t('welcomeTitle') }}</h2>
      <p class="text-textMuted dark:text-dark-textMuted mb-8">
        {{ $t('welcomeDesc') }}
      </p>
      <button
        @click="$emit('create')"
        class="bg-primary text-white px-8 py-3 rounded-lg hover:opacity-90 transition font-semibold"
      >
        {{ $t('createFirstCA') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ create: [] }>()
</script>
