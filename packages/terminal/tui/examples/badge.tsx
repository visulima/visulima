/* eslint-disable jsdoc/check-indentation, jsdoc/escape-inline-tags, jsdoc/lines-before-block, react-refresh/only-export-components */
/**
 * badge.tsx — <Badge> component demo
 *
 * Run: node --import @oxc-node/core/register examples/badge.tsx
 */

import { Badge, Box, render, Text } from "@visulima/tui";
import React from "react";

const App = () => (
    <Box flexDirection="column" gap={1} padding={1}>
        <Text bold color="cyan">
            Badge demo
        </Text>

        <Box gap={2}>
            <Badge color="green">Pass</Badge>
            <Badge color="red">Fail</Badge>
            <Badge color="yellow">Warn</Badge>
            <Badge color="blue">Todo</Badge>
            <Badge>Default</Badge>
        </Box>
    </Box>
);

render(<App />);
