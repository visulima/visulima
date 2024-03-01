import type { StorybookConfig } from "@storybook/react-vite";
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
    viteFinal: async (vConfig) => mergeConfig(vConfig, { plugins: [] }),
};

// eslint-disable-next-line import/no-unused-modules
export default config;
