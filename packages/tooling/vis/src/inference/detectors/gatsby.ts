import type { DetectedTargets, Detector } from "../types";

export const gatsbyDetector: Detector = {
    configFiles: ["gatsby-config.ts", "gatsby-config.js", "gatsby-config.mjs", "gatsby-config.mts", "gatsby-config.cjs"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            build: {
                command: "gatsby build",
                description: "gatsby build (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/static/**/*",
                    ...(configRef ? [configRef] : []),
                    "{projectRoot}/package.json",
                    "{projectRoot}/gatsby-node.js",
                    "{projectRoot}/gatsby-node.ts",
                    "{projectRoot}/gatsby-browser.js",
                    "{projectRoot}/gatsby-ssr.js",
                ],
                outputs: ["{projectRoot}/public", "{projectRoot}/.cache"],
                type: "build",
            },
        };

        if (hasConfigFile) {
            targets["develop"] = {
                command: "gatsby develop",
                description: "gatsby develop (inferred)",
                preset: "server",
            };
            targets["serve"] = {
                command: "gatsby serve",
                description: "gatsby serve (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "gatsby",
    name: "gatsby",
};
