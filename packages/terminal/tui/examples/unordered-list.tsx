/* eslint-disable jsdoc/lines-before-block */
/**
 * unordered-list.tsx — &lt;UnorderedList> component demo
 *
 * Run: node --import @oxc-node/core/register examples/unordered-list.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { UnorderedList } from "@visulima/tui/components/unordered-list";
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
