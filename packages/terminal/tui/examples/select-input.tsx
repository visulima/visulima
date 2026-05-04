/* eslint-disable @typescript-eslint/no-confusing-void-expression, jsdoc/lines-before-block */
/**
 * select-input.tsx — &lt;SelectInput> component demo
 *
 * Controls:
 *   ↑/↓ or j/k   navigate
 *   Enter         select
 *   1–9           jump to item
 *   Esc           quit
 *
 * Run: node --import @oxc-node/core/register examples/select-input.tsx
 */

import { Box, render, SelectInput, Text, useApp, useInput } from "@visulima/tui";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [selected, setSelected] = useState<string | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                SelectInput demo
            </Text>
            <Text dim>↑/↓ navigate · Enter select · 1–9 jump · Esc quit</Text>

            <SelectInput
                initialIndex={0}
                items={[
                    { label: "Red", value: "red" },
                    { label: "Green", value: "green" },
                    { label: "Yellow", value: "yellow" },
                    { isSeparator: true },
                    { label: "Blue", value: "blue" },
                    { label: "Magenta", value: "magenta" },
                    { label: "Cyan", value: "cyan" },
                    { label: "White", value: "white" },
                ]}
                onSelect={(item) => setSelected(item.value)}
            />

            {selected && (
                <Text>
                    Selected:
{" "}
                    <Text bold color="yellow">
                        {selected}
                    </Text>
                </Text>
            )}
        </Box>
    );
};

render(<App />);
