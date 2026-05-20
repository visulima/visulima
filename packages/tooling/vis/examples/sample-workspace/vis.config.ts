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
    // Workspace-wide target defaults. The sample packages run fake echo/sleep
    // scripts that the toolchain detector can't identify, so cache flags fall
    // back to undefined. Declaring `build` here as cacheable with explicit
    // inputs/outputs gives the runner enough to seed an entry on the first
    // run and HIT on subsequent ones.
    tasks: {
        build: {
            cache: true,
            inputs: ["package.json"],
            outputs: ["dist/**"],
        },
    },
});
