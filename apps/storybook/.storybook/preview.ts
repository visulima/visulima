// eslint-disable-next-line import/no-extraneous-dependencies
import { withConsole } from "@storybook/addon-console";
// eslint-disable-next-line import/no-extraneous-dependencies
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, ReactRenderer, StoryContext } from "@storybook/react";

const preview: Preview = {
    decorators: [
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        (storyFunction, context: StoryContext) => withConsole({})(storyFunction)(context),

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
