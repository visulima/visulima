import type { Detector } from "../types";

export const storybookDetector: Detector = {
    configFiles: [".storybook/main.ts", ".storybook/main.js", ".storybook/main.mjs", ".storybook/main.mts", ".storybook/main.cjs"],
    detect: ({ matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        return {
            targets: {
                "build-storybook": {
                    command: "storybook build",
                    description: "storybook build (inferred)",
                    inputs: [
                        "{projectRoot}/src/**/*",
                        "{projectRoot}/.storybook/**/*",
                        "{projectRoot}/stories/**/*",
                        ...(configRef ? [configRef] : []),
                        "{projectRoot}/package.json",
                    ],
                    outputs: ["{projectRoot}/storybook-static"],
                    type: "build",
                },
                storybook: {
                    command: "storybook dev -p 6006",
                    description: "storybook dev (inferred)",
                    preset: "server",
                },
            },
        };
    },
    // No `fallbackDependency`: a `.storybook/main` config is the only
    // reliable signal the project actually configures storybook. The
    // root `storybook` package can appear as a transitive dep without
    // the consumer setting up a config of their own.
    name: "storybook",
};
