/* eslint-disable jsdoc/lines-before-block */
/**
 * badge.tsx — &lt;Badge> component demo
 *
 * Run: node --import @oxc-node/core/register examples/badge.tsx
 */

import { render } from "@visulima/tui";
import { Badge } from "@visulima/tui/components/badge";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
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
