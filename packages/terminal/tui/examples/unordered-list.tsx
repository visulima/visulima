/* eslint-disable jsdoc/check-indentation, jsdoc/escape-inline-tags, jsdoc/lines-before-block, react-refresh/only-export-components */
/**
 * unordered-list.tsx — <UnorderedList> component demo
 *
 * Run: node --import @oxc-node/core/register examples/unordered-list.tsx
 */

import { Box, render, Text, UnorderedList } from "@visulima/tui/ink";
import React from "react";

const App = () => (
    <Box flexDirection="column" gap={1} padding={1}>
        <Text bold color="cyan">
            UnorderedList demo
        </Text>

        <UnorderedList
            items={[
                { label: "Red" },
                {
                    children: [{ label: "Light" }, { label: "Dark" }],
                    label: "Green",
                },
                { label: "Blue" },
                {
                    children: [
                        { label: "Sky" },
                        {
                            children: [{ label: "Neon" }, { label: "Pastel" }],
                            label: "Bright",
                        },
                    ],
                    label: "Purple",
                },
            ]}
        />
    </Box>
);

render(<App />);
