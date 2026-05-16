<template>
  <UIModal :show="true" @close="$emit('close')">
    <div class="text-xl font-semibold mb-4">{{ $t('signCertTitle', { name: caName }) }}</div>

    <form @submit.prevent="handleSign" class="space-y-4">
      <div>
        <label class="block text-sm mb-1">{{ $t('commonNameReq') }} *</label>
        <input
          v-model="form.subject.commonName"
          type="text"
          required
          placeholder="myserver.example.com"
          class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm mb-1">{{ $t('organization') }}</label>
          <input
            v-model="form.subject.organizationName"
            type="text"
            placeholder="My Company"
            class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">{{ $t('country') }}</label>
          <input
            v-model="form.subject.countryName"
            type="text"
            placeholder="US"
            maxlength="2"
            class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm mb-1">{{ $t('dnsNames') }}</label>
        <input
          v-model="dnsNamesInput"
          type="text"
          placeholder="example.com, www.example.com"
          class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
        />
      </div>

      <div>
        <label class="block text-sm mb-1">{{ $t('ipAddresses') }}</label>
        <input
          v-model="ipAddressesInput"
          type="text"
          placeholder="192.168.1.1, 10.0.0.1"
          class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm mb-1">{{ $t('extendedKeyUsage') }}</label>
          <select
            v-model="form.eku"
            class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
          >
            <option value="serverAuth">{{ $t('serverAuth') }}</option>
            <option value="clientAuth">{{ $t('clientAuth') }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm mb-1">{{ $t('validityDays') }}</label>
          <input
            v-model.number="form.days"
            type="number"
            :min="1"
            :max="3650"
            class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm mb-1">{{ $t('keyType') }}</label>
        <select
          v-model="form.keyType"
          class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
        >
          <option value="rsa">{{ $t('keyTypeRsa') }}</option>
          <option value="ed25519">{{ $t('keyTypeEd25519') }}</option>
        </select>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          @click="$emit('close')"
          class="px-4 py-2 rounded border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent"
        >
          {{ $t('cancel') }}
        </button>
        <button
          type="submit"
          :disabled="signing"
          class="px-4 py-2 rounded bg-primary text-white hover:opacity-90 disabled:opacity-50 font-medium"
        >
          {{ signing ? $t('certSigning') : $t('signCert').replace('+ ', '') }}
        </button>
      </div>
    </form>
  </UIModal>
</template>

<script setup lang="ts">
defineEmits<{
  close: []
  signed: []
}>()

const props = defineProps<{
  caName: string
}>()

const certStore = useCertStore()

const form = ref<{
  subject: {
    commonName: string
    organizationName?: string
    countryName?: string
  }
  dnsNames?: string[]
  ipAddresses?: string[]
  eku?: 'serverAuth' | 'clientAuth'
  days: number
  keyType?: 'rsa' | 'ed25519'
}>({
  subject: { commonName: '' },
  days: 364,
  eku: 'serverAuth',
  keyType: 'rsa'
})

const dnsNamesInput = ref('')
const ipAddressesInput = ref('')
const signing = ref(false)

watch(dnsNamesInput, (v) => {
  if (!v) {
    form.value.dnsNames = []
    return
  }
  form.value.dnsNames = v.split(',').map(s => s.trim()).filter(Boolean)
})

watch(ipAddressesInput, (v) => {
  if (!v) {
    form.value.ipAddresses = []
    return
  }
  form.value.ipAddresses = v.split(',').map(s => s.trim()).filter(Boolean)
})

async function handleSign() {
  if (!form.value.subject?.commonName) {
    alert(`${$t('commonNameReq')} is required`)
    return
  }

  signing.value = true
  try {
    await certStore.create(props.caName, {
      subject: form.value.subject,
      dnsNames: form.value.dnsNames || [],
      ipAddresses: form.value.ipAddresses || [],
      eku: form.value.eku || 'serverAuth',
      days: form.value.days || 364,
      keyType: form.value.keyType || 'rsa',
    })
    $emit('signed')
  } catch (err: any) {
    alert(`${$t('error')}: ${err.data?.message || err.message}`)
  } finally {
    signing.value = false
  }
}
</script>
