/**
 * inline-picker.tsx — React inline mode demo
 *
 * A file picker rendered inline (no alternate screen) using React + Ratatat.
 * The selected file is printed to stdout after exit.
 *
 * Run: node --import @oxc-node/core/register examples/inline-picker.tsx
 */

import React, { useState } from "react";
import { Box, Text, renderInline } from "@visulima/tui/react";
import { useInput, useApp } from "@visulima/tui/react";

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

function Picker({ onSelect }: PickerProps) {
    const [selected, setSelected] = useState(0);
    const { quit } = useApp();

    useInput((_input, key) => {
        if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
        if (key.downArrow) setSelected((s) => Math.min(ITEMS.length - 1, s + 1));
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
        <Box flexDirection="column" borderStyle="single" borderColor={238} width="100%">
            <Box paddingX={1}>
                <Text fg={51}>pick a file</Text>
            </Box>
            <Box flexDirection="column">
                {ITEMS.map((item, i) => (
                    <Box key={item} paddingX={1}>
                        <Text fg={i === selected ? 231 : 250} bg={i === selected ? 19 : 0}>
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
}

let result: string | null = null;

const { waitUntilExit } = renderInline(
    <Picker
        onSelect={(item) => {
            result = item;
        }}
    />,
    { rows: ITEMS.length + 4, onExit: "destroy" },
);

waitUntilExit().then(() => {
    if (result) process.stdout.write(`\nSelected: ${result}\n`);
});
