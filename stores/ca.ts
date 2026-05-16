import type { CAListItem } from '~/server/lib/storage'

export const useCAStore = defineStore('ca', () => {
  const cas = ref<CAListItem[]>([])
  const currentCA = ref<string | null>(null)
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      cas.value = await $fetch<CAListItem[]>('/api/ca')
    } finally {
      loading.value = false
    }
  }

  async function create(data: { name: string; subject: any; keyType: 'rsa' | 'ed25519' }): Promise<void> {
    loading.value = true
    try {
      await $fetch('/api/ca', { method: 'POST', body: data })
      await fetchAll()
    } finally {
      loading.value = false
    }
  }

  function select(name: string) {
    currentCA.value = name
  }

  return { cas, currentCA, loading, fetchAll, create, select }
})
