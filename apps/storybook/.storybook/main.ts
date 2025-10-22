import type { StorybookConfig } from "@storybook/react-vite";
// eslint-disable-next-line import/no-extraneous-dependencies
import { mergeConfig } from "vite";
// eslint-disable-next-line import/no-extraneous-dependencies
import tsconfigPaths from "vite-tsconfig-paths";

const config: StorybookConfig = {
    addons: [
        "@storybook/addon-essentials",
        "@storybook/addon-interactions",
        "@storybook/addon-a11y",
        "@storybook/addon-actions",
        "@storybook/addon-themes",
        "@storybook/addon-links",
        "@storybook/addon-docs",
    ],
    docs: {
        autodocs: "tag",
    },
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
    staticDirs: ["../public"],
    stories: ["../packages/**/__stories__/**/*.stories.@(js|jsx|ts|tsx|mdx)"],

    viteFinal: async (vConfig) => mergeConfig(vConfig, { plugins: [tsconfigPaths()] }),
};

export default config;
