/**
 * use-timeout.tsx — useTimeout hook demo
 *
 * Controls:
 *   r        reset the timer
 *   c        cancel the timer
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/use-timeout.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useTimeout } from "@visulima/tui/hooks/use-timeout";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [fired, setFired] = useState(false);

    const timeout = useTimeout(() => {
        setFired(true);
    }, 3000);

    useInput((input, key) => {
        if (key.escape) {
            exit();
        }

        if (input === "r") {
            setFired(false);
            timeout.reset();
        } else if (input === "c") {
            timeout.cancel();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                useTimeout
            </Text>
            {fired ? <Text color="green">✔ timer fired (press r to restart)</Text> : <Text>⏳ waiting 3 seconds…</Text>}
            <Text dimColor>r = reset · c = cancel</Text>
        </Box>
    );
};

render(<App />);
