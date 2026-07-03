import { defineConfig } from "@visulima/vis/config";

// Secure defaults are applied automatically by defineConfig().
// You only need to add allowBuilds for packages with build scripts.
// Run 'vis check --security-config' to see all active settings.
export default defineConfig({
    security: {
        allowBuilds: {
            // "esbuild": true,
        },
    },
});
