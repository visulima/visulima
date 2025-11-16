import { defineConfig } from "@solidjs/start/config";
import { vitePlugin as solidPlugin } from "vite-plugin-solid";

export default defineConfig({
    vite: {
        plugins: [solidPlugin()],
    },
});
