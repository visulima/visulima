/* eslint-disable @typescript-eslint/no-confusing-void-expression, sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/use-stdout
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useStdout } from "@visulima/tui/react";
import React from "react";

if (globalThis.global !== undefined && !globalThis.document) {
    globalThis.document = {
        addEventListener: () => {},
        createElement: () => {
            return {};
        },
        removeEventListener: () => {},
    };
    globalThis.window = globalThis;
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
    });
}

const Example = () => {
    const { stdout, write } = useStdout();

    React.useEffect(() => {
        const timer = setInterval(() => {
            write("Hello from ratatat to stdout\n");
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
            <Text bold underline>
                Terminal dimensions:
            </Text>
            <Box marginTop={1}>
                <Text>
                    Width: <Text bold>{stdout.columns}</Text>
                </Text>
            </Box>
            <Box>
                <Text>
                    Height: <Text bold>{stdout.rows}</Text>
                </Text>
            </Box>
        </Box>
    );
};

render(<Example />);
