/* eslint-disable @typescript-eslint/no-confusing-void-expression, jsdoc/lines-before-block */
/**
 * text-input.tsx — &lt;TextInput> component demo
 *
 * Controls:
 *   Type     enter text
 *   Enter    submit
 *   Esc / q  quit (when not typing)
 *
 * Run: node --import @oxc-node/core/register examples/text-input.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { TextInput } from "@visulima/tui/components/text-input";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [value, setValue] = useState("");
    const [submitted, setSubmitted] = useState<string | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                TextInput demo
            </Text>

            <Box flexDirection="column" gap={1}>
                <TextInput onChange={setValue} onSubmit={(v) => setSubmitted(v)} placeholder="Start typing..." />
                <Text>
                    Input value: "<Text color="green">{value}</Text>"
                </Text>
                {submitted !== undefined && (
                    <Text>
                        Submitted: "
                        <Text bold color="yellow">
                            {submitted}
                        </Text>
                        "
                    </Text>
                )}
            </Box>
        </Box>
    );
};

render(<App />);
