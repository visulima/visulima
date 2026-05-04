/**
 * use-interval.tsx — useInterval hook demo
 *
 * Controls:
 *   Space    pause / resume
 *   r        reset counter
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/use-interval.tsx
 */
import { Box, render, Text, useApp, useInput, useInterval } from "@visulima/tui";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [count, setCount] = useState(0);
    const [running, setRunning] = useState(true);

    useInterval(
        () => {
            setCount((n) => n + 1);
        },
        250,
        { isActive: running },
    );

    useInput((input, key) => {
        if (key.escape) {
            exit();
        }

        if (input === " ") {
            setRunning((r) => !r);
        } else if (input === "r") {
            setCount(0);
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                useInterval
            </Text>
            <Text>
                tick:
{" "}
<Text bold>{count}</Text>
            </Text>
            <Text dimColor>
                status:
                {running ? "running" : "paused"}
{" "}
— press Space to toggle, r to reset
            </Text>
        </Box>
    );
};

render(<App />);
