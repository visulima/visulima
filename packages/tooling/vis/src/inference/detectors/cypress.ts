import type { DetectedTargets, Detector } from "../types";

export const cypressDetector: Detector = {
    configFiles: ["cypress.config.ts", "cypress.config.js", "cypress.config.mjs", "cypress.config.mts", "cypress.config.cjs"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            // `test:e2e` is shared with playwright. Cypress is registered
            // after playwright so playwright wins when both exist; in a
            // cypress-only project this is the active e2e command.
            "test:e2e": {
                command: "cypress run",
                description: "cypress run (inferred)",
                inputs: [
                    "{projectRoot}/cypress/**/*",
                    "{projectRoot}/e2e/**/*",
                    "{projectRoot}/src/**/*",
                    ...(configRef ? [configRef] : []),
                    "{projectRoot}/package.json",
                ],
                outputs: ["{projectRoot}/cypress/screenshots", "{projectRoot}/cypress/videos"],
                type: "test",
            },
        };

        // Interactive runner — only when the user actually configured
        // cypress (not a dep-only match).
        if (hasConfigFile) {
            targets["cypress:open"] = {
                command: "cypress open",
                description: "cypress open (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "cypress",
    name: "cypress",
};
