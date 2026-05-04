import type { Detector } from "../types";

export const webpackDetector: Detector = {
    configFiles: ["webpack.config.ts", "webpack.config.js", "webpack.config.mjs", "webpack.config.mts", "webpack.config.cjs"],
    // No `fallbackDependency`: webpack is a transitive dep of countless
    // toolchains (storybook, react-scripts, …). A root-level
    // `webpack.config.*` is the reliable "this project drives webpack
    // itself" signal.
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                build: {
                    command: "webpack --mode=production",
                    description: "webpack production build (inferred)",
                    inputs: ["{projectRoot}/src/**/*", `{projectRoot}/${matchedConfigs[0]!}`, "{projectRoot}/package.json", "{projectRoot}/tsconfig.json"],
                    outputs: ["{projectRoot}/dist"],
                    type: "build",
                },
            },
        };
    },
    name: "webpack",
};
