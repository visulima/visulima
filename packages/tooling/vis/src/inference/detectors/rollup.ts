import type { Detector } from "../types";

export const rollupDetector: Detector = {
    configFiles: ["rollup.config.ts", "rollup.config.js", "rollup.config.mjs", "rollup.config.mts", "rollup.config.cjs"],
    // No `fallbackDependency`: classic rollup ships as a transitive dep
    // of countless toolchains (vite, tsup, packem, …). A `rollup.config.*`
    // is the only signal the project drives `rollup -c` itself.
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                build: {
                    command: "rollup -c",
                    description: "rollup build (inferred)",
                    inputs: ["{projectRoot}/src/**/*", `{projectRoot}/${matchedConfigs[0]!}`, "{projectRoot}/package.json", "{projectRoot}/tsconfig.json"],
                    outputs: ["{projectRoot}/dist"],
                    type: "build",
                },
            },
        };
    },
    name: "rollup",
};
