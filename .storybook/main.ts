import type { StorybookConfig } from "@storybook/react-vite";
// eslint-disable-next-line import/no-extraneous-dependencies
import { mergeConfig } from "vite";

const config: StorybookConfig = {
    addons: [
        "@storybook/addon-essentials",
        "@storybook/addon-interactions",
        "@storybook/addon-a11y",
        "@storybook/addon-actions/register",
        "@storybook/addon-themes",
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
