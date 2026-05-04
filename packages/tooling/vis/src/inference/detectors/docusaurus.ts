import type { DetectedTargets, Detector } from "../types";

export const docusaurusDetector: Detector = {
    configFiles: ["docusaurus.config.ts", "docusaurus.config.js", "docusaurus.config.mjs", "docusaurus.config.mts", "docusaurus.config.cjs"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            build: {
                command: "docusaurus build",
                description: "docusaurus build (inferred)",
                inputs: [
                    "{projectRoot}/blog/**/*",
                    "{projectRoot}/docs/**/*",
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/static/**/*",
                    ...(configRef ? [configRef] : []),
                    "{projectRoot}/package.json",
                ],
                outputs: ["{projectRoot}/build"],
                type: "build",
            },
        };

        if (hasConfigFile) {
            targets["start"] = {
                command: "docusaurus start",
                description: "docusaurus start (inferred)",
                preset: "server",
            };
            targets["serve"] = {
                command: "docusaurus serve",
                description: "docusaurus serve (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "@docusaurus/core",
    name: "docusaurus",
};
