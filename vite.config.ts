import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { handleApiRequest } from './src/server/apiHandler';

function opticApiPlugin(): Plugin {
  return {
    name: 'optic-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleApiRequest(req, res, next);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [opticApiPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
