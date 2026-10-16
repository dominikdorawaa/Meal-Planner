import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: [
        'src/i18n/index.ts',
        'src/lib/apiClient.ts',
        'src/lib/productPermissions.ts',
        'src/lib/useProductSearch.ts',
        'src/lib/mealProducts.ts',
        'src/lib/nutritionCheck.ts',
        'src/components/LoadMoreTrigger.tsx',
        'src/components/ProductDataAttribution.tsx',
        'src/components/BarcodeScanner.tsx',
        'src/components/LazyBarcodeScanner.tsx',
        'src/lib/barcodeLookup.ts',
        'src/lib/recipeImage.ts',
        'src/components/RecipeCoverImage.tsx',
        'src/components/InstallAppCard.tsx',
        'src/components/BottomNav.tsx',
        'src/lib/useInstallPrompt.ts',
        'src/pages/Onboarding.tsx',
      ],
      reporter: ['text', 'html'],
    },
  },
})
