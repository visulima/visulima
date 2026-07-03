/* eslint-disable sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/use-input
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useApp, useInput } from "@visulima/tui/react";
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

const Robot = () => {
    const { exit } = useApp();
    const [x, setX] = React.useState(1);
    const [y, setY] = React.useState(1);

    useInput((input, key) => {
        if (input === "q") {
            exit();
        }

        if (key.leftArrow) {
            setX((x) => Math.max(1, x - 1));
        }

        if (key.rightArrow) {
            setX((x) => Math.min(20, x + 1));
        }

        if (key.upArrow) {
            setY((y) => Math.max(1, y - 1));
        }

        if (key.downArrow) {
            setY((y) => Math.min(10, y + 1));
        }
    });

    return (
        <Box flexDirection="column">
            <Text>Use arrow keys to move the face. Press "q" to exit.</Text>
            <Box height={12} paddingLeft={x} paddingTop={y}>
                <Text>^_^</Text>
            </Box>
        </Box>
    );
};

render(<Robot />);
