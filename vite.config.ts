import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

import fs from 'fs';

// Custom plugin to remove type="module" which causes issues in file:// protocol
const removeTypeModule = () => {
  return {
    name: 'remove-type-module',
    closeBundle() {
      const indexPath = path.resolve(__dirname, 'dist/index.html');
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = html
          .replace(/type="module"/g, 'type="text/javascript"')
          .replace(/crossorigin/g, '')
          .replace(/export\s*\{[^}]+\}\s*;/g, '')
          .replace(/export\s+default\s+/g, '');
        fs.writeFileSync(indexPath, html);
      }
    },
  };
};

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(), 
      viteSingleFile({ removeViteModuleLoader: true }),
      removeTypeModule()
    ],
    build: {
      target: 'es2015',
      cssTarget: 'chrome61',
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM'
          }
        }
      }
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
