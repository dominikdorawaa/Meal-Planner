import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/i18n/index.ts', 'src/lib/apiClient.ts'],
      reporter: ['text', 'html'],
    },
  },
})
