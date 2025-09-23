import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteErrorOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    viteErrorOverlay(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      sitemap: {
        host: 'https://localhost:3000',
      },
      customViteReactPlugin: true,
    }),
    viteReact(), 
  ],
})
