/* eslint-disable jsdoc/lines-before-block */
/**
 * multi-select.tsx — &lt;MultiSelect> component demo
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

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { MultiSelect } from "@visulima/tui/components/multi-select";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
    const [submitted, setSubmitted] = useState<ReadonlyArray<string> | undefined>();

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
                    <Text>
                        Selected:
                        {selected.join(", ") || "(none)"}
                    </Text>
                </Box>
            ) : (
                <Text color="green">
                    Submitted:
                    {submitted.join(", ")}
                </Text>
            )}
        </Box>
    );
};

render(<App />);
