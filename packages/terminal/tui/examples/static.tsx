/* eslint-disable jsdoc/lines-before-block, sonarjs/pseudo-random */
/**
 * static.tsx — port of the Ink `static` example
 *
 * Demonstrates &lt;Static>: items accumulate above the dynamic UI and are never
 * re-rendered. The progress bar at the bottom updates live while tests complete.
 *
 * Run: node --import @oxc-node/core/register examples/static.tsx
 */
import { Box, Text } from "@visulima/tui";
import { render, Static } from "@visulima/tui/react";
import React, { useEffect, useState } from "react";

type TestResult = {
    id: number;
    passed: boolean;
    title: string;
};

const App = () => {
    const [tests, setTests] = useState<TestResult[]>([]);

    useEffect(() => {
        let count = 0;
        const TOTAL = 12;

        const run = () => {
            if (count >= TOTAL) {
                return;
            }

            const passed = Math.random() > 0.15; // ~85% pass rate

            setTests((previous) => [
                ...previous,
                {
                    id: count,
                    passed,
                    title: `Test #${count + 1}: ${passed ? "passes" : "fails"}`,
                },
            ]);
            count++;

            if (count < TOTAL) {
                setTimeout(run, 200);
            }
        };

        setTimeout(run, 300);
    }, []);

    const passed = tests.filter((t) => t.passed).length;
    const failed = tests.filter((t) => !t.passed).length;
    const done = tests.length;
    const TOTAL = 12;

    return (
        <Box flexDirection="column">
            {/* Static region — completed tests accumulate here, never re-rendered */}
            <Static items={tests}>
                {(test) => (
                    <Box key={test.id}>
                        <Text color={test.passed ? "green" : "red"}>
                            {test.passed ? "✔" : "✘"} {test.title}
                        </Text>
                    </Box>
                )}
            </Static>

            {/* Dynamic region — live progress */}
            <Box flexDirection="column" marginTop={1}>
                <Box>
                    <Text dimColor>
                        Running tests... {done}/{TOTAL}
                        {done === TOTAL ? " — done!" : ""}
                    </Text>
                </Box>
                {done > 0 && (
                    <Box>
                        <Text color="green">{passed} passed</Text>
                        {failed > 0 && <Text color="red"> {failed} failed</Text>}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

render(<App />);
