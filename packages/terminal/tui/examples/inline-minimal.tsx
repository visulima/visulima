/* eslint-disable @typescript-eslint/no-confusing-void-expression */

/**
 * Minimal renderInline test — exits after 1 second, preserve mode.
 * If scrollback is wiped after this exits, the bug is structural in renderInline.
 */
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { renderInline, useApp } from "@visulima/tui/react";
import React from "react";

const App = () => {
    const { quit } = useApp();

    React.useEffect(() => {
        const t = setTimeout(quit, 1000);

        return () => clearTimeout(t);
    }, []);

    return (
        <Box>
            <Text fg={51}>hello from renderInline</Text>
        </Box>
    );
};

renderInline(<App />, { onExit: "preserve", rows: 3 });
