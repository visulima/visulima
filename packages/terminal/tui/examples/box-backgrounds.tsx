// @ts-nocheck
// Ratatat port of ink/examples/box-backgrounds
import React from "react";
import { render, Box, Text } from "@visulima/tui/react";

if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
    });
}

function BoxBackgrounds() {
    return (
        <Box flexDirection="column" gap={1}>
            <Text bold>Box Background Examples:</Text>

            <Box>
                <Text>1. Standard red background (10x3):</Text>
            </Box>
            <Box backgroundColor="red" width={10} height={3} alignSelf="flex-start">
                <Text>Hello</Text>
            </Box>

            <Box>
                <Text>2. Blue background with border (12x4):</Text>
            </Box>
            <Box backgroundColor="blue" borderStyle="round" width={12} height={4} alignSelf="flex-start">
                <Text>Border</Text>
            </Box>

            <Box>
                <Text>3. Green background with padding (14x4):</Text>
            </Box>
            <Box backgroundColor="green" padding={1} width={14} height={4} alignSelf="flex-start">
                <Text>Padding</Text>
            </Box>

            <Box>
                <Text>4. Yellow background center aligned (16x3):</Text>
            </Box>
            <Box backgroundColor="yellow" width={16} height={3} justifyContent="center" alignSelf="flex-start">
                <Text>Centered</Text>
            </Box>

            <Box>
                <Text>5. Magenta background, column layout (12x5):</Text>
            </Box>
            <Box backgroundColor="magenta" flexDirection="column" width={12} height={5} alignSelf="flex-start">
                <Text>Line 1</Text>
                <Text>Line 2</Text>
            </Box>

            <Box>
                <Text>6. Hex color background #FF8800 (10x3):</Text>
            </Box>
            <Box backgroundColor="#FF8800" width={10} height={3} alignSelf="flex-start">
                <Text>Hex</Text>
            </Box>

            <Box>
                <Text>7. RGB background rgb(0,255,0) (10x3):</Text>
            </Box>
            <Box backgroundColor="rgb(0,255,0)" width={10} height={3} alignSelf="flex-start">
                <Text>RGB</Text>
            </Box>

            <Box marginTop={1}>
                <Text>Press Ctrl+C to exit</Text>
            </Box>
        </Box>
    );
}

render(<BoxBackgrounds />);
