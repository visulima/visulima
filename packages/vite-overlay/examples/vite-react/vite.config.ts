import viteErrorOverlay from "@visulima/vite-overlay/dist/index.js";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [viteErrorOverlay(), react()],
});
