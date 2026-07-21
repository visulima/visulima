/**
 * welcome-screen.tsx — Heading, Menu, Badge, Text
 *
 * A first-run welcome/launcher screen composed from display and navigation
 * components. Flow blocks like this ship as examples to copy and adapt, not as
 * library exports.
 *
 * Controls:
 *   ↑/↓      move selection
 *   Enter    choose
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/welcome-screen.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Badge } from "@visulima/tui-kit/badge";
import { Heading } from "@visulima/tui-kit/heading";
import { Menu } from "@visulima/tui-kit/menu";
import React, { useState } from "react";

const ITEMS = [
    { description: "Start a new project from a template", id: "new", label: "New project" },
    { description: "Open an existing project", id: "open", label: "Open" },
    { description: "Edit your preferences", id: "settings", label: "Settings" },
    { description: "Read the docs", id: "help", label: "Help" },
];

const App = () => {
    const { exit } = useApp();
    const [chosen, setChosen] = useState<string | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box borderStyle="round" flexDirection="column" gap={1} paddingX={2} paddingY={1}>
            <Box gap={1}>
                <Heading level={1}>Visulima TUI</Heading>
                <Badge>v2</Badge>
            </Box>
            <Text dimColor>Welcome — what would you like to do?</Text>

            <Menu items={ITEMS} onSelect={(id) => { setChosen(id); }} />

            {chosen === undefined ? <Text dimColor>Enter to choose · Esc to quit</Text> : <Text color="green">{`→ ${chosen}`}</Text>}
        </Box>
    );
};

render(<App />);
