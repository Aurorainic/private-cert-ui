<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        @click.self="$emit('close')"
      >
        <div class="bg-card dark:bg-dark-card rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border dark:border-dark-border">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
}>()

defineEmits<{
  close: []
}>()
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
