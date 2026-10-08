import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const raiz = fileURLToPath(new URL('./src/client', import.meta.url));
const pagina = (nome: string) => fileURLToPath(new URL(`./src/client/${nome}.html`, import.meta.url));

// Quatro telas, um build: inicio, mestre, telao e jogador (celular).
export default defineConfig({
  root: raiz,
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { index: pagina('index'), mestre: pagina('mestre'), telao: pagina('telao'), jogador: pagina('jogador') },
    },
  },
});
