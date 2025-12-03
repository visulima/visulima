import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import viteErrorOverlay from "@visulima/vite-overlay";

export default defineConfig({
    plugins: [viteErrorOverlay(), solid()],
});
