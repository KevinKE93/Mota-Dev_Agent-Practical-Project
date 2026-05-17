import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1'
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) return 'phaser-engine';
          if (id.includes('/node_modules/')) return 'vendor';
        }
      }
    }
  }
});
