import type { StorybookConfig } from "@storybook/react-vite";
// eslint-disable-next-line import/no-extraneous-dependencies
import { mergeConfig } from "vite";

const config: StorybookConfig = {
    // essentials, interactions and actions ship inside the `storybook` core package since v9 and
    // have no v10 release; listing them pulls in v8 builds that import symbols core no longer exports.
    addons: ["@storybook/addon-a11y", "@storybook/addon-themes", "@storybook/addon-links", "@storybook/addon-docs"],
    docs: {
        autodocs: "tag",
    },
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
    staticDirs: ["../public"],
    stories: ["../packages/**/**/__stories__/**/*.stories.@(js|jsx|ts|tsx|mdx)"],

    viteFinal: async (vConfig) => mergeConfig(vConfig, { resolve: { tsconfigPaths: true } }),
};

export default config;
