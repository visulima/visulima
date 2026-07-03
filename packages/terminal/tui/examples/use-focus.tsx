/* eslint-disable jsdoc/lines-before-block */
/**
 * use-focus example — port of the Ink use-focus example
 * Press Tab to cycle focus forward, Shift+Tab to cycle backward.
 * Run: node --import @oxc-node/core/register examples/use-focus.tsx
 */
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useApp, useFocus, useInput } from "@visulima/tui/react";
import React from "react";

const Item = ({ label }: { label: string }) => {
    const { isFocused } = useFocus();

    return (
        <Text>
            {label}
{" "}
{isFocused ? <Text color="green">(focused)</Text> : <Text color="gray">(unfocused)</Text>}
        </Text>
    );
};

const FocusExample = () => {
    const { exit } = useApp();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
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
};

render(<FocusExample />);
