import type { Detector } from "../types";

export const viteDetector: Detector = {
    configFiles: ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.mts", "vite.config.cjs"],
    // No `fallbackDependency`: vite as a transitive/dev dep (plugin
    // helpers, type re-exports, internal tooling) doesn't reliably mean
    // the project bundles itself with `vite build`. Requiring a config
    // file avoids synthesising a broken `build` target for libraries
    // that just depend on vite for `defineConfig` / plugin types.
    detect: ({ matchedConfigs }) => ({
        targets: {
            build: {
                command: "vite build",
                description: "vite production build (inferred)",
                inputs: ["{projectRoot}/src/**/*", `{projectRoot}/${matchedConfigs[0] ?? "vite.config.ts"}`, "{projectRoot}/package.json"],
                outputs: ["{projectRoot}/dist"],
                type: "build",
            },
            dev: {
                command: "vite",
                description: "vite dev server (inferred)",
                preset: "server",
            },
            preview: {
                command: "vite preview",
                description: "vite preview server (inferred)",
                preset: "server",
            },
        },
    }),
    name: "vite",
};
