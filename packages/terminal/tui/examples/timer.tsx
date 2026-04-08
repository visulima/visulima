import { Box, render, Text, Timer, useApp, useInput } from "@visulima/tui";
import type { TimerRef } from "@visulima/tui";
import React, { useRef, useState } from "react";

const App = () => {
    const { exit } = useApp();
    const timerRef = useRef<TimerRef>(null);
    const [duration, setDuration] = useState(30_000);

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        } else if (input === "s") {
            timerRef.current?.start();
        } else if (input === "p") {
            timerRef.current?.stop();
        } else if (input === "t") {
            timerRef.current?.toggle();
        } else if (input === "r") {
            timerRef.current?.reset();
        } else if (input === "+") {
            setDuration((d) => d + 10_000);
        } else if (input === "-") {
            setDuration((d) => Math.max(1000, d - 10_000));
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Timer demo
            </Text>
            <Box borderColor="cyan" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Box gap={1}>
                    <Text>Countdown:</Text>
                    <Timer ref={timerRef} bold color="yellow" duration={duration} onTimeout={() => {}} />
                </Box>
                <Text dimColor>Duration: {duration / 1000}s</Text>
            </Box>
            <Box flexDirection="column">
                <Text dimColor>s = start · p = pause · t = toggle · r = reset</Text>
                <Text dimColor>+/- = adjust duration · q = quit</Text>
            </Box>
        </Box>
    );
};

render(<App />);
