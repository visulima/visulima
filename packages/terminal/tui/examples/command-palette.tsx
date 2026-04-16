/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/**
 * command-palette.tsx — CommandPalette fuzzy finder
 *
 * Controls:
 *   (type)   filter commands
 *   ↑ / ↓    navigate results
 *   Enter    select
 *   Esc      cancel / quit
 *
 * Run: node --import @oxc-node/core/register examples/command-palette.tsx
 */
import { Box, CommandPalette, render, Text, useApp } from "@visulima/tui";
import React, { useState } from "react";

const COMMANDS = [
    { hotkey: "Ctrl+N", id: "file.new", keywords: ["create"], label: "File: New" },
    { hotkey: "Ctrl+O", id: "file.open", label: "File: Open…" },
    { hotkey: "Ctrl+S", id: "file.save", label: "File: Save" },
    { description: "Format the current file with Prettier", id: "format", keywords: ["prettier", "style"], label: "Format Document" },
    { description: "Jump to any symbol", hotkey: "Ctrl+P", id: "goto.symbol", label: "Go to Symbol…" },
    { description: "Reveal a file in the explorer", hotkey: "Ctrl+E", id: "files.reveal", label: "Reveal in Explorer" },
    { description: "Re-index the workspace", id: "workspace.reindex", label: "Reindex Workspace" },
    { description: "Restart the language server", id: "lang.restart", label: "Restart Language Server" },
];

const App = () => {
    const { exit } = useApp();
    const [picked, setPicked] = useState<string | undefined>();

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">Command palette</Text>
            <CommandPalette
                commands={COMMANDS}
                onCancel={exit}
                onSelect={(id) => {
                    setPicked(id);
                    exit();
                }}
            />
            {picked !== undefined && (
                <Text color="green">
                    selected:
                    {" "}
                    {picked}
                </Text>
            )}
        </Box>
    );
};

render(<App />);
