import "@storybook/addon-console";

import type { Preview } from "@storybook/react";
import { withThemeByDataAttribute } from "@storybook/addon-styling";
import { withConsole } from "@storybook/addon-console";

const preview: Preview = {
    decorators: [
        (storyFn, context) => withConsole()(storyFn)(context),
        withThemeByDataAttribute({
            themes: {
                light: "light",
                dark: "dark",
            },
            defaultTheme: "light",
            attributeName: "data-mode",
        }),
    ],
    parameters: {
        actions: { argTypesRegex: "^on[A-Z].*" },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/,
            },
        },
    },
};

export default preview;
