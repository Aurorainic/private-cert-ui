export default defineNuxtConfig({
  ssr: false,

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    '@nuxt/icon'
  ],

  runtimeConfig: {
    port: 3000,
    caMasterKey: ''
  },

  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark'
  },

  i18n: {
    locales: [
      { code: 'zh', iso: 'zh-CN', name: '中文', file: 'zh.json' },
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' }
    ],
    defaultLocale: 'zh',
    lazy: true,
    langDir: 'public/locales/',
    strategy: 'no_prefix',
    bundle: {
      optimizeTranslationDirective: false
    }
  },

  // Static files served by Nuxt
  app: {
    head: {
      htmlAttrs: { lang: 'zh' }
    }
  },

  css: ['~/assets/css/main.css'],

  typescript: {
    typeCheck: false,
    strict: false
  },

  nitro: {
    experimental: { wasm: true },
    esbuild: {
      options: {
        target: 'es2022'
      }
    }
  }
})