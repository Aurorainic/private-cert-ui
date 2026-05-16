<template>
  <div class="p-6 h-full overflow-y-auto">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">{{ $t('helpTitle') }}</h1>
      <p class="text-textMuted dark:text-dark-textMuted mb-8">
        {{ $t('helpIntro') }}
      </p>

      <div class="space-y-4">
        <div v-for="(value, key) in helpItems" :key="key" class="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-primary mb-2">{{ $t(key) }}</h3>
          <p class="text-textMuted dark:text-dark-textMuted leading-relaxed">
            {{ $t(value) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const helpItems: Record<string, string> = {
  helpWhatIsCA: 'helpWhatIsCADesc',
  helpWhatIsRootCA: 'helpWhatIsRootCADesc',
  helpWhatIsCert: 'helpWhatIsCertDesc',
  helpWhatIsSAN: 'helpWhatIsSANDesc',
  helpWhatIsEKU: 'helpWhatIsEKUDesc',
  helpWhatIsSerial: 'helpWhatIsSerialDesc',
  helpWhatIsValidity: 'helpWhatIsValidityDesc',
}
</script>
