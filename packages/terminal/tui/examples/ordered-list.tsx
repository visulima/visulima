/* eslint-disable jsdoc/check-indentation, jsdoc/escape-inline-tags, jsdoc/lines-before-block, react-refresh/only-export-components */
/**
 * ordered-list.tsx — <OrderedList> component demo
 *
 * Run: node --import @oxc-node/core/register examples/ordered-list.tsx
 */

import { Box, OrderedList, render, Text } from "@visulima/tui/ink";
import React from "react";

const App = () => (
    <Box flexDirection="column" gap={1} padding={1}>
        <Text bold color="cyan">
            OrderedList demo
        </Text>

        <OrderedList
            items={[
                { label: "Install dependencies" },
                {
                    children: [{ label: "Create config file" }, { label: "Set environment variables" }],
                    label: "Configure",
                },
                { label: "Build" },
                {
                    children: [{ label: "Unit tests" }, { label: "Integration tests" }],
                    label: "Test",
                },
                { label: "Deploy" },
            ]}
        />
    </Box>
);

render(<App />);
