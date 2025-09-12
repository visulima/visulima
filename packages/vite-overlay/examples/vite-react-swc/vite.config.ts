import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import viteErrorOverlay from "../../dist/index.js";

// https://vite.dev/config/
export default defineConfig({
  plugins: [viteErrorOverlay(), react()],
})
