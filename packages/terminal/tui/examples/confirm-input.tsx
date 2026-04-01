/* eslint-disable @typescript-eslint/no-confusing-void-expression, jsdoc/check-indentation, jsdoc/escape-inline-tags, jsdoc/lines-before-block, react-refresh/only-export-components */
/**
 * confirm-input.tsx — <ConfirmInput> component demo
 *
 * Controls:
 *   Y        confirm
 *   N        cancel
 *   Enter    submit default choice
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/confirm-input.tsx
 */

import { Box, ConfirmInput, render, Text, useApp, useInput } from "@visulima/tui";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [choice, setChoice] = useState<"agreed" | "disagreed" | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                ConfirmInput demo
            </Text>

            {!choice && (
                <Box gap={1}>
                    <Text bold>Do you agree with terms of service?</Text>
                    <ConfirmInput onCancel={() => setChoice("disagreed")} onConfirm={() => setChoice("agreed")} />
                </Box>
            )}

            {choice === "agreed" && <Text color="green">I know you haven't read them, but ok</Text>}
            {choice === "disagreed" && <Text color="red">Ok, whatever</Text>}
        </Box>
    );
};

render(<App />);
