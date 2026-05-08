import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useStopwatch } from "@visulima/tui/hooks/use-stopwatch";
import React from "react";

const App = () => {
    const { exit } = useApp();
    const sw = useStopwatch({ autoStart: true });

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        } else {
            switch (input) {
                case "l": {
                    sw.lap();

                    break;
                }
                case "p": {
                    sw.stop();

                    break;
                }
                case "r": {
                    sw.reset();

                    break;
                }
                case "s": {
                    sw.start();

                    break;
                }
                case "t": {
                    sw.toggle();

                    break;
                }
                // No default
            }
        }
    });

    const formatElapsed = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((ms % 1000) / 100);

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
    };

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Stopwatch demo
            </Text>
            <Box borderColor="cyan" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Box gap={1}>
                    <Text>Elapsed:</Text>
                    <Text bold color="green">
                        {formatElapsed(sw.elapsed)}
                    </Text>
                    <Text dimColor>{sw.isRunning ? "(running)" : "(stopped)"}</Text>
                </Box>
                {sw.laps.length > 0 && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text bold>Laps:</Text>
                        {sw.laps.map((lap, i) => (
                            <Text key={i}>
                                {"  "}
                                {i + 1}
.
{formatElapsed(lap)}
                            </Text>
                        ))}
                    </Box>
                )}
            </Box>
            <Box flexDirection="column">
                <Text dimColor>s = start · p = pause · t = toggle · r = reset · l = lap</Text>
                <Text dimColor>q = quit</Text>
            </Box>
        </Box>
    );
};

render(<App />);
