import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('gmp-') || tag.startsWith('gmpx-'),
        },
      },
    }),
  ],
})
