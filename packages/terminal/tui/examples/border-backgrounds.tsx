/* eslint-disable sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/border-backgrounds
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

const BorderBackgrounds = () => (
    <Box flexDirection="column" gap={1}>
        <Box borderBackgroundColor="blue" borderColor="white" borderStyle="round" padding={1}>
            <Text>Box with blue background on white border</Text>
        </Box>

        <Box borderBackgroundColor="yellow" borderColor="black" borderStyle="single" padding={1}>
            <Text>Box with yellow background on black border</Text>
        </Box>

        <Box
            borderBottomBackgroundColor="yellow"
            borderBottomColor="blue"
            borderLeftBackgroundColor="magenta"
            borderLeftColor="cyan"
            borderRightBackgroundColor="red"
            borderRightColor="white"
            borderStyle="double"
            borderTopBackgroundColor="green"
            borderTopColor="red"
            padding={1}
        >
            <Text>Box with different colors per side</Text>
        </Box>

        <Box borderBackgroundColor="rgb(128, 0, 128)" borderColor="white" borderDimColor borderStyle="classic" padding={1}>
            <Text>Box with dimmed RGB purple background on border</Text>
        </Box>

        <Box borderBackgroundColor="#00FF00" borderColor="#FF00FF" borderStyle="bold" padding={1}>
            <Text>Box with hex color backgrounds</Text>
        </Box>
    </Box>
);

render(<BorderBackgrounds />);
