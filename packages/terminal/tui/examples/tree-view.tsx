/* eslint-disable jsdoc/lines-before-block */
/**
 * tree-view.tsx — &lt;TreeView> component demo
 *
 * Controls:
 *   ↑/↓         navigate
 *   → / Enter   expand (or move to first child)
 *   ← / Enter   collapse (or move to parent)
 *   Space        toggle selection (multi-select mode)
 *   Esc          quit
 *
 * Run: node --import @oxc-node/core/register examples/tree-view.tsx
 */

import type { TreeNode } from "@visulima/tui";
import { Box, render, Text, TreeView, useApp, useInput } from "@visulima/tui";
import React, { useState } from "react";

const fileTree: TreeNode[] = [
    {
        children: [
            {
                children: [
                    { id: "src/components/App.tsx", label: "App.tsx" },
                    { id: "src/components/Header.tsx", label: "Header.tsx" },
                    { id: "src/components/Sidebar.tsx", label: "Sidebar.tsx" },
                ],
                id: "src/components",
                label: "components",
            },
            {
                children: [
                    { id: "src/hooks/useAuth.ts", label: "useAuth.ts" },
                    { id: "src/hooks/useTheme.ts", label: "useTheme.ts" },
                ],
                id: "src/hooks",
                label: "hooks",
            },
            { id: "src/index.ts", label: "index.ts" },
        ],
        id: "src",
        label: "src",
    },
    {
        children: [
            { id: "tests/App.test.tsx", label: "App.test.tsx" },
            { id: "tests/hooks.test.ts", label: "hooks.test.ts" },
        ],
        id: "tests",
        label: "tests",
    },
    { id: "package.json", label: "package.json" },
    { id: "tsconfig.json", label: "tsconfig.json" },
    { id: "README.md", label: "README.md" },
];

const App = () => {
    const { exit } = useApp();
    const [focusedId, setFocusedId] = useState<string | undefined>();
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                TreeView demo — file browser
            </Text>
            <Text dim>↑/↓ navigate · →/Enter expand · ←/Enter collapse · Space select · Esc quit</Text>

            <Box flexDirection="row" gap={4}>
                <Box flexDirection="column" minWidth={40}>
                    <TreeView
                        data={fileTree}
                        defaultExpanded={new Set(["src"])}
                        onFocusChange={setFocusedId}
                        onSelectChange={setSelectedIds}
                        selectionMode="multiple"
                    />
                </Box>

                <Box borderColor="gray" borderStyle="single" flexDirection="column" paddingX={2} paddingY={1}>
                    <Text bold>Info</Text>
                    {focusedId && (
                        <Text>
                            Focused:
{" "}
<Text color="blue">{focusedId}</Text>
                        </Text>
                    )}
                    {selectedIds.size > 0 && (
                        <Box flexDirection="column" marginTop={1}>
                            <Text bold>
                                Selected (
{selectedIds.size}
                                ):
                            </Text>
                            {[...selectedIds].map((id) => (
                                <Text color="green" key={id}>
                                    {" "}
                                    {id}
                                </Text>
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

render(<App />);
