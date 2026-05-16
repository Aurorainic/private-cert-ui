<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="internalShow"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        @click.self="handleClose"
      >
        <div class="bg-card dark:bg-dark-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border dark:border-dark-border">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">
              {{ $t(type === 'cert' ? 'certPreview' : 'keyPreview') }}
              <span v-if="titleSuffix" class="text-textMuted dark:text-dark-textMuted ml-2">
                — {{ titleSuffix }}
              </span>
            </h3>
            <button
              @click="handleClose"
              class="text-textMuted dark:text-dark-textMuted hover:text-text dark:hover:text-dark-text"
            >
              ✕
            </button>
          </div>

          <div
            class="mb-4 inline-block px-3 py-1 rounded text-xs font-semibold font-mono"
            :class="{
              'bg-success/10 text-success border-success': type === 'cert',
              'bg-danger/10 text-danger border-danger': type === 'key'
            }"
          >
            {{ $t(type === 'cert' ? 'certLabel' : 'keyLabel') }}
          </div>

          <pre
            class="bg-bg dark:bg-dark-bg border border-border dark:border-dark-border rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed max-h-[50vh] overflow-y-auto"
          >
            {{ content || $t('loading') }}
          </pre>

          <div class="flex gap-2">
            <button
              @click="handleCopy"
              :disabled="!content"
              class="flex-1 bg-primary text-white py-2 rounded hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {{ $t('copyContent') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean
  serial: string
  type: 'cert' | 'key'
}>()

const emit = defineEmits<{
  close: []
}>()

const internalShow = computed(() => props.show)
const content = ref('')
const titleSuffix = ref('')

watch(() => props.show, (newShow) => {
  if (newShow) {
    fetchContent()
  } else {
    content.value = ''
    titleSuffix.value = ''
  }
})

async function fetchContent() {
  // Determine URL - parent component should set titleSuffix via context
  const url = props.type === 'cert'
    ? `/api/cert/[CA_NAME]/${props.serial}/cert.pem`
    : `/api/cert/[CA_NAME]/${props.serial}/key.pem`

  try {
    const text = await $fetch<string>(url, { parseResponse: false })
    content.value = text
  } catch (err: any) {
    content.value = `${$t('error')}: ${err.message}`
  }
}

function handleClose() {
  emit('close')
}

async function handleCopy() {
  if (!content.value) return

  try {
    await navigator.clipboard.writeText(content.value)
    alert($t('copied'))
  } catch {
    // Fallback
    const textarea = document.createElement('textarea')
    textarea.value = content.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    alert($t('copied'))
  }
}
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
