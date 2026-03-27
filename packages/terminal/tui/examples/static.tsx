/**
 * static.tsx — port of the Ink `static` example
 *
 * Demonstrates <Static>: items accumulate above the dynamic UI and are never
 * re-rendered. The progress bar at the bottom updates live while tests complete.
 *
 * Run: node --import @oxc-node/core/register examples/static.tsx
 */
import React, { useState, useEffect } from "react";
import { render, Box, Text, Static } from "@visulima/tui/react";

type TestResult = {
    id: number;
    title: string;
    passed: boolean;
};

function App() {
    const [tests, setTests] = useState<TestResult[]>([]);

    useEffect(() => {
        let count = 0;
        const TOTAL = 12;

        const run = () => {
            if (count >= TOTAL) return;

            const passed = Math.random() > 0.15; // ~85% pass rate
            setTests((prev) => [
                ...prev,
                {
                    id: count,
                    title: `Test #${count + 1}: ${passed ? "passes" : "fails"}`,
                    passed,
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
            <Box marginTop={1} flexDirection="column">
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
}

render(<App />);
