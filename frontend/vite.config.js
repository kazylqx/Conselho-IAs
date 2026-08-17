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
    rollupOptions: {
      output: {
        /**
         * Separa React em um chunk proprio: ele quase nunca muda, entao o
         * navegador reaproveita o cache entre deploys. O Firebase fica de fora
         * desta regra de proposito — o Firestore entra por import dinamico
         * (services/firebase.js) e deve continuar em um chunk separado, longe
         * do carregamento inicial.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
});
