import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        index_4w: resolve(__dirname, 'index_4w.html'),
        index_4w_real_map: resolve(__dirname, 'index_4w_real_map.html'),
        index_4w_map_box: resolve(__dirname, 'index_4w_map_box.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'vendor_three';
            }
            if (id.includes('cannon-es')) {
              return 'vendor_physics';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})
