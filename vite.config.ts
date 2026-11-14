import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // blog/ 是独立的 Astro 子项目（自己的 vitest 5 + tsconfig），
  // 根目录测试只收集 SPA 的 src/**，避免误扫 blog/tests 报 tsconfig extends 解析错误。
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Local dev: same-origin account backend (Go service on loopback).
      // In production nginx proxies /account-api/ to the same service.
      '/account-api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
