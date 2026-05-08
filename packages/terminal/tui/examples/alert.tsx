/* eslint-disable jsdoc/lines-before-block */
/**
 * alert.tsx — &lt;Alert> component demo
 *
 * Run: node --import @oxc-node/core/register examples/alert.tsx
 */

import { render } from "@visulima/tui";
import { Alert } from "@visulima/tui/components/alert";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import React from "react";

const App = () => (
    <Box flexDirection="column" gap={1} padding={1} width={60}>
        <Text bold color="cyan">
            Alert demo
        </Text>

        <Alert variant="success">A new version of this CLI is available</Alert>
        <Alert variant="error">Your license is expired</Alert>
        <Alert variant="warning">Current version of this CLI has been deprecated</Alert>
        <Alert variant="info">API won't be available tomorrow night</Alert>
        <Alert title="Important Notice" variant="info">
            Check the documentation for migration instructions.
        </Alert>
    </Box>
);

render(<App />);
