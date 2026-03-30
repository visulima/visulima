/* eslint-disable @typescript-eslint/no-confusing-void-expression, jsdoc/check-indentation, jsdoc/escape-inline-tags, jsdoc/lines-before-block, react-refresh/only-export-components */
/**
 * multi-select.tsx — <MultiSelect> component demo
 *
 * Controls:
 *   ↑/↓ or j/k   navigate
 *   Space         toggle selection
 *   a             select/deselect all
 *   Enter         submit
 *   Esc           quit
 *
 * Run: node --import @oxc-node/core/register examples/multi-select.tsx
 */

import { Box, MultiSelect, render, Text, useApp, useInput } from "@visulima/tui/ink";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [selected, setSelected] = useState<readonly string[]>([]);
    const [submitted, setSubmitted] = useState<readonly string[] | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                MultiSelect demo
            </Text>
            <Text dim>↑/↓ navigate · Space toggle · a all · Enter submit · Esc quit</Text>

            {submitted === undefined ? (
                <Box flexDirection="column" gap={1}>
                    <MultiSelect
                        onChange={setSelected}
                        onSubmit={setSubmitted}
                        options={[
                            { label: "Red", value: "red" },
                            { label: "Green", value: "green" },
                            { label: "Yellow", value: "yellow" },
                            { label: "Blue", value: "blue" },
                            { label: "Magenta", value: "magenta" },
                            { label: "Cyan", value: "cyan" },
                            { label: "White", value: "white" },
                        ]}
                    />
                    <Text>Selected: {selected.join(", ") || "(none)"}</Text>
                </Box>
            ) : (
                <Text color="green">Submitted: {submitted.join(", ")}</Text>
            )}
        </Box>
    );
};

render(<App />);
