import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  server: {
    host: true, // Позволяет доступ к серверу через публичный IP
    port: 5173,
    allowedHosts: ['datafet.onrender.com'], // ✅ Добавлено для решения ошибки
  },
});