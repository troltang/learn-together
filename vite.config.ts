import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // 允许在客户端代码中使用 process.env.API_KEY (适配原有代码逻辑)
    // 注意：在 Vite 中通常使用 import.meta.env.VITE_...，这里为了兼容做了polyfill
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY || process.env.API_KEY)
  }
});