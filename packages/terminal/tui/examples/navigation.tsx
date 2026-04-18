/**
 * navigation.tsx — Menu, Tooltip, ContentSwitcher, OptionList
 *
 * Controls:
 *   ↑ / ↓ / j / k    navigate menu
 *   Enter            pick menu item
 *   ← / →            switch ContentSwitcher panel
 *   h                toggle tooltip visibility
 *   Esc              quit
 *
 * Run: node --import @oxc-node/core/register examples/navigation.tsx
 */
import { Box, ContentSwitcher, Menu, OptionList, render, Text, Tooltip, useApp, useInput } from "@visulima/tui";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [lastPicked, setLastPicked] = useState<string | undefined>();
    const [showTooltip, setShowTooltip] = useState(true);

    useInput((input, key) => {
        if (key.escape) {
            exit();
        }

        if (input === "h") {
            setShowTooltip((v) => !v);
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Menu
            </Text>
            <Menu
                autoFocus
                onSelect={setLastPicked}
                sections={[
                    {
                        id: "file",
                        items: [
                            { hotkey: "Ctrl+N", id: "new", label: "New File" },
                            { hotkey: "Ctrl+O", id: "open", label: "Open…" },
                            { hotkey: "Ctrl+S", id: "save", label: "Save" },
                        ],
                        title: "File",
                    },
                    {
                        id: "edit",
                        items: [
                            { hotkey: "Ctrl+Z", id: "undo", label: "Undo" },
                            { id: "redo", isDisabled: true, label: "Redo (nothing to redo)" },
                        ],
                        title: "Edit",
                    },
                ]}
                title="Application"
            />
            {lastPicked === undefined
                ? undefined
                : (
                    <Text dimColor>
                        last picked:
                        {lastPicked}
                    </Text>
                )}
            <Text bold color="cyan">
                Tooltip (press `h` to toggle)
            </Text>
            <Tooltip content="This prints a greeting" isVisible={showTooltip}>
                <Text color="yellow">$ hello</Text>
            </Tooltip>
            <Text bold color="cyan">
                ContentSwitcher
            </Text>
            <ContentSwitcher
                options={[
                    { content: <Text>Everything is healthy 🟢</Text>, id: "dashboard", label: "Dashboard" },
                    { content: <Text>Last deploy: 2 minutes ago</Text>, id: "deploys", label: "Deploys" },
                    { content: <Text>3 active incidents</Text>, id: "alerts", label: "Alerts" },
                ]}
            />
            <Text bold color="cyan">
                OptionList (read-only)
            </Text>
            <OptionList
                currentId="medium"
                options={[
                    { description: "~100 ms", id: "small", label: "Small" },
                    { description: "~500 ms", id: "medium", label: "Medium" },
                    { description: "~2 s", id: "large", label: "Large" },
                ]}
            />
        </Box>
    );
};

render(<App />);
