import type { CertMeta } from '~/server/lib/storage'

export const useCertStore = defineStore('cert', () => {
  const certs = ref<Map<string, CertMeta[]>>(new Map())
  const loading = ref(false)

  async function fetch(caName: string) {
    loading.value = true
    try {
      const list = await $fetch<CertMeta[]>(`/api/cert/${caName}/certs`)
      certs.value.set(caName, list)
    } finally {
      loading.value = false
    }
  }

  async function create(caName: string, data: any): Promise<void> {
    loading.value = true
    try {
      await $fetch(`/api/cert/${caName}/certs`, { method: 'POST', body: data })
      await fetch(caName)
    } finally {
      loading.value = false
    }
  }

  async function remove(caName: string, serial: string): Promise<void> {
    loading.value = true
    try {
      await $fetch(`/api/cert/${caName}/${serial}`, { method: 'DELETE' })
      const list = certs.value.get(caName)
      if (list) {
        certs.value.set(caName, list.filter((c) => c.serial !== serial))
      }
    } finally {
      loading.value = false
    }
  }

  function getByCA(caName: string): CertMeta[] {
    return certs.value.get(caName) || []
  }

  return { certs, loading, fetch, create, remove, getByCA }
})
