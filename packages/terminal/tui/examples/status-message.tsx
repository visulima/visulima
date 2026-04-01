/* eslint-disable jsdoc/check-indentation, jsdoc/escape-inline-tags, jsdoc/lines-before-block, react-refresh/only-export-components */
/**
 * status-message.tsx — <StatusMessage> component demo
 *
 * Run: node --import @oxc-node/core/register examples/status-message.tsx
 */

import { Box, render, StatusMessage, Text } from "@visulima/tui";
import React from "react";

const App = () => (
    <Box flexDirection="column" gap={1} padding={1}>
        <Text bold color="cyan">
            StatusMessage demo
        </Text>

        <Box flexDirection="column">
            <StatusMessage variant="success">Build completed successfully</StatusMessage>
            <StatusMessage variant="error">Connection failed</StatusMessage>
            <StatusMessage variant="warning">Disk space low</StatusMessage>
            <StatusMessage variant="info">3 updates available</StatusMessage>
        </Box>
    </Box>
);

render(<App />);
