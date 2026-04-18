/**
 * definition-list.tsx — key/value pairs rendered inline and stacked
 *
 * Run: node --import @oxc-node/core/register examples/definition-list.tsx
 */
import { Box, DefinitionList, render, Text, useApp, useInput } from "@visulima/tui";
import React from "react";

const App = () => {
    const { exit } = useApp();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={2} padding={1}>
            <Text bold color="cyan">
                Inline layout
            </Text>
            <DefinitionList
                items={[
                    { description: "1.0.0-alpha.2", term: "Version" },
                    { description: "MIT", term: "License" },
                    { description: ">= 22.13 < 26", term: "Node" },
                    { description: "React 19.2+", term: "Runtime" },
                ]}
                termWidth={10}
            />
            <Text bold color="cyan">
                Stacked layout
            </Text>
            <DefinitionList
                items={[
                    {
                        description: "Custom terminal UI components with a native Rust diff engine.",
                        term: "What is @visulima/tui?",
                    },
                    {
                        description: "Ink-compatible API means most apps run unchanged.",
                        term: "Can I migrate from Ink?",
                    },
                ]}
                layout="stacked"
            />
            <Text dimColor>Esc to quit</Text>
        </Box>
    );
};

render(<App />);
