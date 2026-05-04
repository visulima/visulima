import type { DetectedTargets, Detector } from "../types";

export const nuxtDetector: Detector = {
    configFiles: ["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs", "nuxt.config.mts", "nuxt.config.cjs"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;
        const sharedBuildInputs = [
            "{projectRoot}/app/**/*",
            "{projectRoot}/components/**/*",
            "{projectRoot}/composables/**/*",
            "{projectRoot}/layouts/**/*",
            "{projectRoot}/pages/**/*",
            "{projectRoot}/plugins/**/*",
            "{projectRoot}/public/**/*",
            "{projectRoot}/server/**/*",
            "{projectRoot}/src/**/*",
            ...(configRef ? [configRef] : []),
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
        ];

        const targets: DetectedTargets["targets"] = {
            build: {
                command: "nuxt build",
                description: "nuxt build (inferred)",
                inputs: sharedBuildInputs,
                outputs: ["{projectRoot}/.output", "{projectRoot}/.nuxt"],
                type: "build",
            },
            generate: {
                command: "nuxt generate",
                description: "nuxt generate static site (inferred)",
                inputs: sharedBuildInputs,
                outputs: ["{projectRoot}/.output", "{projectRoot}/dist"],
                type: "build",
            },
        };

        if (hasConfigFile) {
            targets["dev"] = {
                command: "nuxt dev",
                description: "nuxt dev (inferred)",
                preset: "server",
            };
            targets["preview"] = {
                command: "nuxt preview",
                description: "nuxt preview (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "nuxt",
    name: "nuxt",
};
