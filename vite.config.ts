import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5174,
      strictPort: true,
      host: '0.0.0.0',
      headers: {
        'Content-Security-Policy': 'frame-ancestors *',
        'X-Frame-Options': 'ALLOWALL',
      },
      cors: true,
    },
    preview: {
      port: 4173,
      strictPort: true,
      host: '0.0.0.0',
      headers: {
        'Content-Security-Policy': 'frame-ancestors *',
        'X-Frame-Options': 'ALLOWALL',
      },
      cors: true,
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
