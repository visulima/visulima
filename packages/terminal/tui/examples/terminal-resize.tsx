// @ts-nocheck
// Ratatat port of ink/examples/terminal-resize
import React from "react";
import { render, Box, Text, useWindowSize } from "@visulima/tui/react";

if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
    });
}

function TerminalResizeExample() {
    const { columns, rows } = useWindowSize();

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">
                Terminal Size
            </Text>
            <Text>Columns: {columns}</Text>
            <Text>Rows: {rows}</Text>
            <Box marginTop={1}>
                <Text dim>Resize your terminal to see the values update. Press Ctrl+C to exit.</Text>
            </Box>
        </Box>
    );
}

render(<TerminalResizeExample />);
