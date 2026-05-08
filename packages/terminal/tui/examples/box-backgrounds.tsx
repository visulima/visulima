/* eslint-disable sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/box-backgrounds
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

const BoxBackgrounds = () => (
    <Box flexDirection="column" gap={1}>
        <Text bold>Box Background Examples:</Text>

        <Box>
            <Text>1. Standard red background (10x3):</Text>
        </Box>
        <Box alignSelf="flex-start" backgroundColor="red" height={3} width={10}>
            <Text>Hello</Text>
        </Box>

        <Box>
            <Text>2. Blue background with border (12x4):</Text>
        </Box>
        <Box alignSelf="flex-start" backgroundColor="blue" borderStyle="round" height={4} width={12}>
            <Text>Border</Text>
        </Box>

        <Box>
            <Text>3. Green background with padding (14x4):</Text>
        </Box>
        <Box alignSelf="flex-start" backgroundColor="green" height={4} padding={1} width={14}>
            <Text>Padding</Text>
        </Box>

        <Box>
            <Text>4. Yellow background center aligned (16x3):</Text>
        </Box>
        <Box alignSelf="flex-start" backgroundColor="yellow" height={3} justifyContent="center" width={16}>
            <Text>Centered</Text>
        </Box>

        <Box>
            <Text>5. Magenta background, column layout (12x5):</Text>
        </Box>
        <Box alignSelf="flex-start" backgroundColor="magenta" flexDirection="column" height={5} width={12}>
            <Text>Line 1</Text>
            <Text>Line 2</Text>
        </Box>

        <Box>
            <Text>6. Hex color background #FF8800 (10x3):</Text>
        </Box>
        <Box alignSelf="flex-start" backgroundColor="#FF8800" height={3} width={10}>
            <Text>Hex</Text>
        </Box>

        <Box>
            <Text>7. RGB background rgb(0,255,0) (10x3):</Text>
        </Box>
        <Box alignSelf="flex-start" backgroundColor="rgb(0,255,0)" height={3} width={10}>
            <Text>RGB</Text>
        </Box>

        <Box marginTop={1}>
            <Text>Press Ctrl+C to exit</Text>
        </Box>
    </Box>
);

render(<BoxBackgrounds />);
