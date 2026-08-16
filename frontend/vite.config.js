import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuracao do Vite. Nada de segredo aqui: apenas variaveis VITE_* chegam
// ao navegador, e as chaves de IA nunca saem do backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
