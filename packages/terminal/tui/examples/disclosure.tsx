/**
 * disclosure.tsx — Accordion & Collapsible
 *
 * Controls:
 *   ↑ / ↓    move focus between accordion panels
 *   Enter    toggle accordion panel
 *   Space    toggle collapsible
 *   Tab      switch between the two widgets
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/disclosure.tsx
 */
import { Accordion, Box, Collapsible, render, Text, useApp, useInput } from "@visulima/tui";
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
                Accordion (single open)
            </Text>
            <Accordion
                autoFocus
                items={[
                    {
                        content: <Text>Welcome to the docs. Use the arrow keys to browse.</Text>,
                        id: "intro",
                        title: "Introduction",
                    },
                    {
                        content: <Text>Installation instructions, platform bindings, etc.</Text>,
                        id: "setup",
                        title: "Getting started",
                    },
                    {
                        content: <Text>API reference for hooks, components, and helpers.</Text>,
                        id: "api",
                        title: "API reference",
                    },
                ]}
            />
            <Text bold color="cyan">
                Collapsible (multi-row body)
            </Text>
            <Collapsible defaultOpen title="Release notes">
                <Text>✔ Added Canvas + BarChart primitives</Text>
                <Text>✔ Added Transition / AnimatePresence</Text>
                <Text>✔ Added useInterval / useHotkey / usePersistentState</Text>
            </Collapsible>
        </Box>
    );
};

render(<App />);
