import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const ICON_BACKGROUND = '#16233a'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { background: ICON_BACKGROUND },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: ICON_BACKGROUND },
    },
  },
  images: ['public/favicon.svg'],
})
