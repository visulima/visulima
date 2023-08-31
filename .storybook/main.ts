import type { StorybookConfig } from "@storybook/react-vite";
import postcss from "postcss";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
    addons: [
        "@storybook/addon-essentials",
        "@storybook/addon-interactions",
        "@storybook/addon-a11y",
        "@storybook/addon-actions/register",
        {
            name: "@storybook/addon-styling",
            options: {
                // Check out https://github.com/storybookjs/addon-styling/blob/main/docs/api.md
                // For more details on this addon's options.
                postCss: {
                    implementation: postcss,
                },
            },
        },
    ],
    docs: {
        autodocs: "tag",
    },
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
    stories: ["../packages/**/__stories__/**/*.stories.@(js|jsx|ts|tsx|mdx)"],

    viteFinal: async (vConfig) =>
        mergeConfig(vConfig, {
            plugins: [],
        }),
};

export default config;
