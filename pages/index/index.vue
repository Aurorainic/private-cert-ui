<template>
  <div class="flex items-center justify-center h-full text-center text-textMuted dark:text-dark-textMuted">
    {{ $t('redirectingToCA') }}
  </div>
</template>

<script setup lang="ts">
const router = useRouter()

onMounted(() => {
  router.replace('/ca')
})
</script>
