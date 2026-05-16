<template>
  <UIModal :show="true" @close="$emit('close')">
    <div class="text-xl font-semibold mb-4">{{ $t('createCA') }}</div>

    <form @submit.prevent="handleCreate" class="space-y-4">
      <div>
        <label class="block text-sm mb-1">{{ $t('caName') }} *</label>
        <input
          v-model="form.name"
          type="text"
          required
          placeholder="my-root-ca"
          class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
        />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm mb-1">{{ $t('commonName') }} *</label>
          <input
            v-model="form.subject.commonName"
            type="text"
            required
            placeholder="My Root CA"
            class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">{{ $t('organization') }}</label>
          <input
            v-model="form.subject.organizationName"
            type="text"
            placeholder="My Company"
            class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
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
        <div>
          <label class="block text-sm mb-1">{{ $t('state') }}</label>
          <input
            v-model="form.subject.stateOrProvinceName"
            type="text"
            placeholder="California"
            class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
          />
        </div>
      </div>
      <div>
        <label class="block text-sm mb-1">{{ $t('locality') }}</label>
        <input
          v-model="form.subject.localityName"
          type="text"
          placeholder="San Francisco"
          class="w-full px-3 py-2 rounded border border-border dark:border-dark-border bg-bg dark:bg-dark-bg focus:outline-none focus:border-primary"
        />
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
          :disabled="creating"
          class="px-4 py-2 rounded bg-primary text-white hover:opacity-90 disabled:opacity-50"
        >
          {{ creating ? $t('generating') : $t('createCA') }}
        </button>
      </div>
    </form>
  </UIModal>
</template>

<script setup lang="ts">
defineEmits<{ close: [] }>()

const caStore = useCAStore()

const form = ref<{
  name: string
  subject: {
    commonName: string
    organizationName?: string
    countryName?: string
    stateOrProvinceName?: string
    localityName?: string
  }
  keyType: 'rsa' | 'ed25519'
}>({
  name: '',
  subject: { commonName: '' },
  keyType: 'rsa'
})

const creating = ref(false)

async function handleCreate() {
  if (!form.value.name || !form.value.subject.commonName) {
    alert(`${$t('caName')} and ${$t('commonName')} are required`)
    return
  }

  creating.value = true
  try {
    await caStore.create(form.value)
  } catch (err: any) {
    alert(`${$t('error')}: ${err.data?.message || err.message}`)
  } finally {
    creating.value = false
  }
}
</script>
