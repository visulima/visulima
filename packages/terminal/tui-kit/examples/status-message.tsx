/* eslint-disable jsdoc/lines-before-block */
/**
 * status-message.tsx — &lt;StatusMessage> component demo
 *
 * Run: node --import @oxc-node/core/register examples/status-message.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { StatusMessage } from "@visulima/tui-kit/status-message";
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
