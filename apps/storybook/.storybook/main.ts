import type { StorybookConfig } from "@storybook/react-vite";
// eslint-disable-next-line import/no-extraneous-dependencies
import { mergeConfig } from "vite";
// eslint-disable-next-line import/no-extraneous-dependencies
import tsconfigPaths from "vite-tsconfig-paths";
import viteErrorOverlay from "@visulima/flame/vite";

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
    viteFinal: async (vConfig) => mergeConfig(vConfig, { plugins: [tsconfigPaths(), viteErrorOverlay()] }),
};

// eslint-disable-next-line import/no-unused-modules
export default config;
