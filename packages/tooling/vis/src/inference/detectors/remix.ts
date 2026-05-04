import type { DetectedTargets, Detector } from "../types";

export const remixDetector: Detector = {
    configFiles: ["remix.config.ts", "remix.config.js", "remix.config.mjs", "remix.config.cjs"],
    // No `fallbackDependency`: modern Remix is Vite-driven and the
    // `@remix-run/*` packages frequently appear as transitive deps of
    // `@remix-run/react` consumers that aren't full apps. A
    // `remix.config.*` file is the reliable signal.
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            build: {
                command: "remix vite:build",
                description: "remix build (inferred)",
                inputs: [
                    "{projectRoot}/app/**/*",
                    "{projectRoot}/public/**/*",
                    ...(configRef ? [configRef] : []),
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                ],
                outputs: ["{projectRoot}/build"],
                type: "build",
            },
        };

        if (hasConfigFile) {
            targets["dev"] = {
                command: "remix vite:dev",
                description: "remix dev (inferred)",
                preset: "server",
            };
            targets["start"] = {
                command: "remix-serve ./build/server/index.js",
                description: "remix-serve (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    name: "remix",
};
