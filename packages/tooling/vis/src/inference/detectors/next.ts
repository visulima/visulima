import type { DetectedTargets, Detector } from "../types";

export const nextDetector: Detector = {
    configFiles: ["next.config.ts", "next.config.js", "next.config.mjs", "next.config.mts", "next.config.cjs"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            build: {
                command: "next build",
                description: "next build (inferred)",
                inputs: [
                    "{projectRoot}/app/**/*",
                    "{projectRoot}/pages/**/*",
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/public/**/*",
                    ...(configRef ? [configRef] : []),
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                ],
                outputs: ["{projectRoot}/.next", "!{projectRoot}/.next/cache"],
                type: "build",
            },
        };

        // Long-running servers only emit when a config file exists, so a
        // dep-only match doesn't sprout phantom dev/start commands.
        if (hasConfigFile) {
            targets["dev"] = {
                command: "next dev",
                description: "next dev (inferred)",
                preset: "server",
            };
            targets["start"] = {
                command: "next start",
                description: "next start (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "next",
    name: "next",
};
