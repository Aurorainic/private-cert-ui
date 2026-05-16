<template>
  <div v-if="caData">
    <div class="mb-6">
      <h2 class="text-2xl font-bold mb-2">{{ caData.name }}</h2>
      <div class="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-lg p-4">
        <p class="text-sm mb-1"><strong>{{ $t('subject') }}</strong> {{ caData.subject }}</p>
        <p class="text-sm mb-1"><strong>{{ $t('serial') }}</strong> {{ caData.serialNumber }}</p>
        <p class="text-sm mb-1"><strong>{{ $t('keyType') }}</strong> {{ caData.keyType.toUpperCase() }}</p>
        <p class="text-sm mb-1"><strong>{{ $t('created') }}</strong> {{ formatDate(caData.notBefore) }}</p>
        <p class="text-sm"><strong>{{ $t('expires') }}</strong> {{ formatDate(caData.notAfter) }}</p>
      </div>
      <a
        :href="`/api/ca/${props.caName}/cert.pem`"
        download
        class="bg-accent dark:bg-dark-accent hover:opacity-80 inline-block px-4 py-2 rounded text-sm font-medium"
      >
        {{ $t('downloadCACert') }}
      </a>
    </div>

    <div class="mb-6 flex items-center justify-between">
      <h3 class="text-lg font-semibold">{{ $t('signedCerts') }}</h3>
      <button
        @click="showSignModal = true"
        class="bg-primary text-white px-4 py-2 rounded hover:opacity-90 font-medium"
      >
        {{ $t('signCert') }}
      </button>
    </div>

    <div v-if="certStore.loading" class="text-center text-textMuted dark:text-dark-textMuted py-8">
      {{ $t('loading') }}
    </div>
    <div v-else-if="certStore.getByCA(props.caName).length === 0" class="text-center text-textMuted dark:text-dark-textMuted py-8">
      {{ $t('noCerts') }}
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="cert in certStore.getByCA(props.caName)"
        :key="cert.serial"
        class="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-lg p-4 flex items-center justify-between gap-4"
      >
        <div class="flex-1 min-w-0">
          <div class="font-semibold">{{ cert.subject.commonName }}</div>
          <div class="text-sm text-textDim dark:text-dark-textDim font-mono">{{ cert.serial }}</div>
          <div class="text-sm text-textMuted dark:text-dark-textMuted">
            {{ $t('expires') }}: {{ formatDate(cert.notAfter) }}
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button
            @click="openPreviewModal(cert.serial, 'cert')"
            class="bg-transparent border border-primary text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded text-sm"
          >
            {{ $t('preview') }} {{ $t('certLabel') }}
          </button>
          <button
            @click="openPreviewModal(cert.serial, 'key')"
            class="bg-transparent border border-primary text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded text-sm"
          >
            {{ $t('preview') }} {{ $t('keyLabel') }}
          </button>
          <a
            :href="`/api/cert/${props.caName}/${cert.serial}/cert.pem`"
            download
            class="bg-accent dark:bg-dark-accent hover:opacity-80 px-3 py-1.5 rounded text-sm"
          >
            {{ $t('certLabel') }}
          </a>
          <a
            :href="`/api/cert/${props.caName}/${cert.serial}/key.pem`"
            download
            class="bg-accent dark:bg-dark-accent hover:opacity-80 px-3 py-1.5 rounded text-sm"
          >
            {{ $t('keyLabel') }}
          </a>
          <button
            @click="deleteCert(cert.serial, cert.subject.commonName)"
            class="bg-transparent border border-danger text-danger hover:bg-danger hover:text-white px-3 py-1.5 rounded text-sm"
          >
            {{ $t('delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <CertSignModal
    v-if="showSignModal"
    :ca-name="props.caName"
    @close="showSignModal = false"
    @signed="onCertSigned"
  />

  <UIPreviewModal
    :show="previewModal.show"
    :serial="previewModal.serial"
    :type="previewModal.type"
    :title-suffix="props.caName"
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  caName: string
}>()

const certStore = useCertStore()
const showSignModal = ref(false)
const previewModal = ref<{ show: boolean; serial: string; type: 'cert' | 'key' }>({ show: false, serial: '', type: 'cert' })

const caData = ref<any>(null)

onMounted(async () => {
  try {
    caData.value = await $fetch(`/api/ca/${props.caName}`)
    await certStore.fetch(props.caName)
  } catch (err: any) {
    console.error('Failed to load CA:', err)
  }
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString()
}

function openPreviewModal(serial: string, type: 'cert' | 'key') {
  previewModal.value = { show: true, serial, type }
}

async function onCertSigned() {
  await certStore.fetch(props.caName)
}

async function deleteCert(serial: string, cn: string) {
  const msg = $t('deleteConfirm', { cn, serial })
  if (!confirm(msg)) return

  try {
    await certStore.remove(props.caName, serial)
  } catch (err: any) {
    alert(`${$t('error')}: ${err.data?.message || err.message}`)
  }
}
</script>
