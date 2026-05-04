/* eslint-disable promise/always-return, promise/catch-or-return, unicorn/prefer-top-level-await */

/**
 * inline-picker.tsx — React inline mode demo
 *
 * A file picker rendered inline (no alternate screen) using React + Ratatat.
 * The selected file is printed to stdout after exit.
 *
 * Run: node --import @oxc-node/core/register examples/inline-picker.tsx
 */

import { Box, Text } from "@visulima/tui";
import { renderInline, useApp, useInput } from "@visulima/tui/react";
import React, { useState } from "react";

const ITEMS = [
    "src/app.ts",
    "src/hooks.ts",
    "src/input.ts",
    "src/layout.ts",
    "src/reconciler.ts",
    "src/renderer.ts",
    "src/styles.ts",
    "src/terminal.rs",
    "src/inline.ts",
];

interface PickerProps {
    onSelect: (item: string | null) => void;
}

const Picker = ({ onSelect }: PickerProps) => {
    const [selected, setSelected] = useState(0);
    const { quit } = useApp();

    useInput((_input, key) => {
        if (key.upArrow) {
            setSelected((s) => Math.max(0, s - 1));
        }

        if (key.downArrow) {
            setSelected((s) => Math.min(ITEMS.length - 1, s + 1));
        }

        if (key.return) {
            onSelect(ITEMS[selected]!);
            quit();
        }

        if (key.escape || (key.ctrl && _input === "c")) {
            onSelect(null);
            quit();
        }
    });

    return (
        <Box borderColor={238} borderStyle="single" flexDirection="column" width="100%">
            <Box paddingX={1}>
                <Text fg={51}>pick a file</Text>
            </Box>
            <Box flexDirection="column">
                {ITEMS.map((item, i) => (
                    <Box key={item} paddingX={1}>
                        <Text bg={i === selected ? 19 : 0} fg={i === selected ? 231 : 250}>
                            {i === selected ? "› " : "  "}
                            {item}
                        </Text>
                    </Box>
                ))}
            </Box>
            <Box paddingX={1}>
                <Text fg={238}>↑↓ navigate enter select ctrl+c cancel</Text>
            </Box>
        </Box>
    );
};

let result: string | null = null;

const { waitUntilExit } = renderInline(
    <Picker
        onSelect={(item) => {
            result = item;
        }}
    />,
    { onExit: "destroy", rows: ITEMS.length + 4 },
);

// eslint-disable-next-line @typescript-eslint/no-floating-promises -- demo top-level promise
waitUntilExit().then(() => {
    if (result) {
        process.stdout.write(`\nSelected: ${result}\n`);
    }
});
