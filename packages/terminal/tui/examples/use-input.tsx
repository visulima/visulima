// @ts-nocheck
// Ratatat port of ink/examples/use-input
import React from "react";
import { render, useInput, useApp, Box, Text } from "@visulima/tui/react";

if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
    });
}

function Robot() {
    const { exit } = useApp();
    const [x, setX] = React.useState(1);
    const [y, setY] = React.useState(1);

    useInput((input, key) => {
        if (input === "q") exit();
        if (key.leftArrow) setX((x) => Math.max(1, x - 1));
        if (key.rightArrow) setX((x) => Math.min(20, x + 1));
        if (key.upArrow) setY((y) => Math.max(1, y - 1));
        if (key.downArrow) setY((y) => Math.min(10, y + 1));
    });

    return (
        <Box flexDirection="column">
            <Text>Use arrow keys to move the face. Press "q" to exit.</Text>
            <Box height={12} paddingLeft={x} paddingTop={y}>
                <Text>^_^</Text>
            </Box>
        </Box>
    );
}

render(<Robot />);
