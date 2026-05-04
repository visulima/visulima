import type { DetectedTargets, Detector } from "../types";

export const vitepressDetector: Detector = {
    configFiles: [
        ".vitepress/config.ts",
        ".vitepress/config.js",
        ".vitepress/config.mjs",
        ".vitepress/config.mts",
        ".vitepress/config.cjs",
        "docs/.vitepress/config.ts",
        "docs/.vitepress/config.js",
        "docs/.vitepress/config.mjs",
        "docs/.vitepress/config.mts",
        "docs/.vitepress/config.cjs",
    ],
    // No `fallbackDependency`: vitepress builds on top of vite and the
    // `vitepress` package can appear in workspaces that don't ship docs
    // themselves (shared themes, plugin packages). A config file under
    // `.vitepress/` is the reliable signal.
    detect: ({ matchedConfigs }) => {
        // Detect whether the config sits at the root or under `docs/`,
        // then point the CLI at the right directory. Without this, a
        // `docs/.vitepress/config.ts` setup would otherwise emit
        // `vitepress build` (no path), which only works when the cwd
        // is the project root and the config is also there.
        const isDocs = matchedConfigs[0]?.startsWith("docs/");
        const docDirectory = isDocs ? "docs" : ".";
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const sharedInputs = ["{projectRoot}/.vitepress/**/*", "{projectRoot}/docs/**/*", ...(configRef ? [configRef] : []), "{projectRoot}/package.json"];

        const targets: DetectedTargets["targets"] = {
            "docs:build": {
                command: `vitepress build ${docDirectory}`,
                description: "vitepress build (inferred)",
                inputs: sharedInputs,
                outputs: [`{projectRoot}/${isDocs ? "docs/" : ""}.vitepress/dist`],
                type: "build",
            },
            "docs:dev": {
                command: `vitepress dev ${docDirectory}`,
                description: "vitepress dev (inferred)",
                preset: "server",
            },
            "docs:preview": {
                command: `vitepress preview ${docDirectory}`,
                description: "vitepress preview (inferred)",
                preset: "server",
            },
        };

        return { targets };
    },
    name: "vitepress",
};
