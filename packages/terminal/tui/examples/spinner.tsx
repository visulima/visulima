/* eslint-disable @typescript-eslint/no-confusing-void-expression, jsdoc/lines-before-block */
/**
 * spinner.tsx — &lt;Spinner> component demo
 *
 * Controls:
 *   + / =   faster
 *   -       slower
 *   q / Esc quit
 *
 * Run: node --import @oxc-node/core/register examples/spinner.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Spinner } from "@visulima/tui/components/spinner";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useEffect, useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [intervalMs, setIntervalMs] = useState(80);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setSeconds((s) => s + 1), 1000);

        return () => clearInterval(t);
    }, []);

    useInput((input, key) => {
        if (key.escape || input === "q" || (key.ctrl && input === "c")) {
            exit();

            return;
        }

        if (input === "+" || input === "=") {
            setIntervalMs((ms) => Math.max(20, ms - 20));
        }

        if (input === "-") {
            setIntervalMs((ms) => Math.min(400, ms + 20));
        }
    });

    return (
        <Box flexDirection="column" gap={1}>
            <Text bold color="cyan">
                Spinner demo
            </Text>
            <Text dim>
                +/= faster · - slower · current interval{" "}
                <Text color="yellow">
                    {intervalMs}
                    ms
                </Text>{" "}
                · q quit
            </Text>

            <Box borderColor="cyan" borderStyle="round" flexDirection="column" gap={1} paddingX={2} paddingY={1}>
                <Box flexDirection="row" gap={1}>
                    <Spinner color="cyan" interval={intervalMs} />
                    <Text>default braille frames</Text>
                </Box>

                <Box flexDirection="row" gap={1}>
                    <Spinner color="yellow" frames={["-", "\\", "|", "/"]} interval={Math.max(40, intervalMs + 40)} />
                    <Text>ascii frames</Text>
                </Box>

                <Box flexDirection="row" gap={1}>
                    <Spinner color="magenta" frames={["◐", "◓", "◑", "◒"]} interval={Math.max(30, intervalMs - 20)} />
                    <Text>unicode quarter frames</Text>
                </Box>
            </Box>

            <Text>
                uptime: <Text color="green">{seconds}s</Text>
            </Text>
        </Box>
    );
};

render(<App />);
