/* eslint-disable sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/justify-content
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

const JustifyContent = () => (
    <Box flexDirection="column">
        <Box>
            <Text>[</Text>
            <Box height={1} justifyContent="flex-start" width={20}>
                <Text>X</Text>
                <Text>Y</Text>
            </Box>
            <Text>] flex-start</Text>
        </Box>
        <Box>
            <Text>[</Text>
            <Box height={1} justifyContent="flex-end" width={20}>
                <Text>X</Text>
                <Text>Y</Text>
            </Box>
            <Text>] flex-end</Text>
        </Box>
        <Box>
            <Text>[</Text>
            <Box height={1} justifyContent="center" width={20}>
                <Text>X</Text>
                <Text>Y</Text>
            </Box>
            <Text>] center</Text>
        </Box>
        <Box>
            <Text>[</Text>
            <Box height={1} justifyContent="space-around" width={20}>
                <Text>X</Text>
                <Text>Y</Text>
            </Box>
            <Text>] space-around</Text>
        </Box>
        <Box>
            <Text>[</Text>
            <Box height={1} justifyContent="space-between" width={20}>
                <Text>X</Text>
                <Text>Y</Text>
            </Box>
            <Text>] space-between</Text>
        </Box>
        <Box>
            <Text>[</Text>
            <Box height={1} justifyContent="space-evenly" width={20}>
                <Text>X</Text>
                <Text>Y</Text>
            </Box>
            <Text>] space-evenly</Text>
        </Box>
    </Box>
);

render(<JustifyContent />);
