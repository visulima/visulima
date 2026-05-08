/* eslint-disable sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/terminal-resize
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useWindowSize } from "@visulima/tui/react";
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

const TerminalResizeExample = () => {
    const { columns, rows } = useWindowSize();

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">
                Terminal Size
            </Text>
            <Text>
                Columns:
                {columns}
            </Text>
            <Text>
                Rows:
                {rows}
            </Text>
            <Box marginTop={1}>
                <Text dim>Resize your terminal to see the values update. Press Ctrl+C to exit.</Text>
            </Box>
        </Box>
    );
};

render(<TerminalResizeExample />);
