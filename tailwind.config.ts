export default {
  darkMode: 'class',
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './plugins/**/*.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#e94560',
        bg: '#f5f6fa',
        'dark-bg': '#1a1a2e',
        card: '#ffffff',
        'dark-card': '#16213e',
        text: '#2c3e50',
        'dark-text': '#e0e0e0',
        textMuted: '#7f8c9b',
        'dark-textMuted': '#8899aa',
        textDim: '#b0bec5',
        'dark-textDim': '#5a6a7a',
        border: '#dce1e8',
        'dark-border': '#2a2a4a',
        accent: '#d4e0f0',
        'dark-accent': '#0f3460',
        activeBg: '#fce8ec',
        'dark-activeBg': '#2a1a30',
        success: '#2ecc71',
        danger: '#e74c3c'
      }
    }
  }
}
