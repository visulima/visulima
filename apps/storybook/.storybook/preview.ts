// eslint-disable-next-line import/no-extraneous-dependencies
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, ReactRenderer } from "@storybook/react";

// `@storybook/addon-console` is abandoned at v3 and imports `action`/`configureActions` from
// `@storybook/addon-actions`, which stopped exporting them once actions moved into core.
const preview: Preview = {
    decorators: [
        withThemeByClassName<ReactRenderer>({
            defaultTheme: "light",
            themes: {
                dark: "dark",
                light: "",
            },
        }),
    ],
    parameters: {
        actions: { argTypesRegex: "^on[A-Z].*" },
        controls: {
            matchers: {
                color: /(background|color)$/iu,
                date: /Date$/u,
            },
        },
    },
};

export default preview;
