import type { DetectedTargets, Detector } from "../types";

export const astroDetector: Detector = {
    configFiles: ["astro.config.ts", "astro.config.js", "astro.config.mjs", "astro.config.mts", "astro.config.cjs"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            build: {
                command: "astro build",
                description: "astro build (inferred)",
                inputs: ["{projectRoot}/src/**/*", "{projectRoot}/public/**/*", ...(configRef ? [configRef] : []), "{projectRoot}/package.json"],
                outputs: ["{projectRoot}/dist"],
                type: "build",
            },
        };

        if (hasConfigFile) {
            targets["dev"] = {
                command: "astro dev",
                description: "astro dev (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "astro",
    name: "astro",
};
