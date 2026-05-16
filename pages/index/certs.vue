<template>
  <div class="p-6 h-full overflow-y-auto">
    <h2 class="text-2xl font-bold mb-6">{{ $t('allCerts') }}</h2>

    <div v-if="certStore.loading" class="text-center text-textMuted dark:text-dark-textMuted">
      {{ $t('loading') }}
    </div>
    <div v-else-if="allCerts.length === 0" class="text-center text-textMuted dark:text-dark-textMuted">
      {{ $t('noAllCerts') }}
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="cert in allCerts"
        :key="cert.serial + cert.caName"
        class="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-lg p-4 flex items-center justify-between gap-4"
      >
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-lg">{{ cert.subject.commonName }}</div>
          <div class="text-sm text-textMuted dark:text-dark-textMuted">
            {{ $t('fromCA') }}: {{ cert.caName }}
          </div>
          <div class="text-xs text-textDim dark:text-dark-textDim font-mono">
            {{ $t('serial') }}: {{ cert.serial }}
          </div>
          <div class="text-sm text-textMuted dark:text-dark-textMuted">
            {{ $t('expires') }}: {{ formatDate(cert.notAfter) }}
          </div>
          <div v-if="cert.keyType" class="text-xs text-textDim dark:text-dark-textDim">
            {{ $t('keyType') }}: {{ cert.keyType.toUpperCase() }}
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <a
            :href="`/api/cert/${cert.caName}/${cert.serial}/cert.pem`"
            download
            class="bg-accent dark:bg-dark-accent hover:opacity-80 px-3 py-1.5 rounded text-sm"
          >
            {{ $t('certLabel') }}
          </a>
          <a
            :href="`/api/cert/${cert.caName}/${cert.serial}/key.pem`"
            download
            class="bg-accent dark:bg-dark-accent hover:opacity-80 px-3 py-1.5 rounded text-sm"
          >
            {{ $t('keyLabel') }}
          </a>
          <button
            @click="deleteCert(cert.caName, cert.serial, cert.subject.commonName)"
            class="bg-danger text-white hover:opacity-80 px-3 py-1.5 rounded text-sm"
          >
            {{ $t('delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const certStore = useCertStore()
const caStore = useCAStore()
const allCerts = computed(() => {
  const certs: any[] = []
  caStore.cas.forEach(ca => {
    const caCerts = certStore.getByCA(ca.name)
    caCerts.forEach(cert => {
      certs.push({ ...cert, caName: ca.name })
    })
  })
  return certs
})

async function deleteCert(caName: string, serial: string, cn: string) {
  const msg = $t('deleteConfirm', { cn, serial })
  if (!confirm(msg)) return

  try {
    await certStore.remove(caName, serial)
  } catch (err: any) {
    alert(`${$t('error')}: ${err.data?.message || err.message}`)
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString()
}

await Promise.all(caStore.cas.map(ca => certStore.fetch(ca.name)))
</script>
