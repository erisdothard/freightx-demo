import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    // Gzip compression for all build assets
    compression({ algorithm: 'gzip', ext: '.gz' }),
    // Brotli compression (smaller than gzip, supported by modern browsers)
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
    // Run `pnpm build:analyze` to open bundle map in browser
    ...(process.env.ANALYZE === 'true'
      ? [visualizer({ open: true, gzipSize: true, filename: 'dist/stats.html' }) as never]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
          maps: ['leaflet', 'react-leaflet'],
          supabase: ['@supabase/supabase-js'],
          stripe: ['@stripe/stripe-js'],
          pdf: ['jspdf'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', '../../test/test-features/**/*.test.ts'],
  },
});
