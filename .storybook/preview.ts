import { withConsole } from "@storybook/addon-console";
import { withThemeByDataAttribute } from "@storybook/addon-styling";
import type { Preview, StoryContext } from "@storybook/react";

const preview: Preview = {
    decorators: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-unsafe-return
        (storyFunction, context: StoryContext) => withConsole({})(storyFunction)(context),
        withThemeByDataAttribute({
            attributeName: "data-mode",
            defaultTheme: "light",
            themes: {
                dark: "dark",
                light: "light",
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
