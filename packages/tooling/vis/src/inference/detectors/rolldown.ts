import type { Detector } from "../types";

export const rolldownDetector: Detector = {
    configFiles: ["rolldown.config.ts", "rolldown.config.js", "rolldown.config.mjs", "rolldown.config.mts", "rolldown.config.cjs"],
    // No `fallbackDependency`: rolldown often appears as a transitive
    // dep via vite/tsdown, so a config file is the only signal that
    // the project actually drives a `rolldown -c` build itself.
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                build: {
                    command: "rolldown -c",
                    description: "rolldown build (inferred)",
                    inputs: [
                        "{projectRoot}/src/**/*",
                        // `matchedConfigs[0]` is always defined here: rolldown has
                        // no `fallbackDependency`, so the registry skips this
                        // detector unless at least one config file matched.
                        `{projectRoot}/${matchedConfigs[0]!}`,
                        "{projectRoot}/package.json",
                        "{projectRoot}/tsconfig.json",
                    ],
                    outputs: ["{projectRoot}/dist"],
                    type: "build",
                },
            },
        };
    },
    name: "rolldown",
};
