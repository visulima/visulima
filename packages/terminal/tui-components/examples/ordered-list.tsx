/* eslint-disable jsdoc/lines-before-block */
/**
 * ordered-list.tsx — &lt;OrderedList> component demo
 *
 * Run: node --import @oxc-node/core/register examples/ordered-list.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { OrderedList } from "@visulima/tui-components/ordered-list";
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
