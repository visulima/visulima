/* eslint-disable sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/borders
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render } from "@visulima/tui/react";
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

const Borders = () => (
    <Box flexDirection="column" padding={2}>
        <Box>
            <Box borderStyle="single" marginRight={2}>
                <Text>single</Text>
            </Box>
            <Box borderStyle="double" marginRight={2}>
                <Text>double</Text>
            </Box>
            <Box borderStyle="round" marginRight={2}>
                <Text>round</Text>
            </Box>
            <Box borderStyle="bold">
                <Text>bold</Text>
            </Box>
        </Box>
        <Box marginTop={1}>
            <Box borderStyle="singleDouble" marginRight={2}>
                <Text>singleDouble</Text>
            </Box>
            <Box borderStyle="doubleSingle" marginRight={2}>
                <Text>doubleSingle</Text>
            </Box>
            <Box borderStyle="classic">
                <Text>classic</Text>
            </Box>
        </Box>
    </Box>
);

render(<Borders />);
