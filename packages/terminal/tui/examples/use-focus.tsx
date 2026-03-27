/**
 * use-focus example — port of the Ink use-focus example
 * Press Tab to cycle focus forward, Shift+Tab to cycle backward.
 * Run: node --import @oxc-node/core/register examples/use-focus.tsx
 */
import React from "react";
import { Box, Text, render, useFocus, useInput, useApp } from "@visulima/tui/react";

function Item({ label }: { label: string }) {
    const { isFocused } = useFocus();
    return (
        <Text>
            {label} {isFocused ? <Text color="green">(focused)</Text> : <Text color="gray">(unfocused)</Text>}
        </Text>
    );
}

function FocusExample() {
    const { exit } = useApp();

    useInput((_input, key) => {
        if (key.escape) exit();
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text>Press Tab / Shift+Tab to cycle focus, Esc to quit.</Text>
            </Box>
            <Item label="First" />
            <Item label="Second" />
            <Item label="Third" />
        </Box>
    );
}

render(<FocusExample />);
