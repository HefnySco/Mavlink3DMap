import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        index_4w: resolve(__dirname, 'index_4w.html'),
        index_4w_real_map: resolve(__dirname, 'index_4w_real_map.html'),
        index_4w_map_box: resolve(__dirname, 'index_4w_map_box.html'),
      },
    },
  },
})
