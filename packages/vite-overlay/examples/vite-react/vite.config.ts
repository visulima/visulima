import viteErrorOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [viteErrorOverlay(), react()],
});
