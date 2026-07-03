import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import viteErrorOverlay from "@visulima/vite-overlay";

// https://vite.dev/config/
export default defineConfig({
    plugins: [viteErrorOverlay(), svelte()],
});
