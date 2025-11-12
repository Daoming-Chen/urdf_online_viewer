import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/urdf_online_viewer/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        simple: './simple.html',
        vr: './vr.html'
      }
    }
  }
})
