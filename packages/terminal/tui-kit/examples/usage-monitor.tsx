/**
 * usage-monitor.tsx — TokenUsage, MultiProgress, Gauge, Digits, TokenUsage
 *
 * A live-ish "agent usage" dashboard composed from data-display widgets. Flow
 * blocks like this are intentionally shipped as examples rather than library
 * exports: they are compositions you copy and adapt, not primitives.
 *
 * Controls:
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/usage-monitor.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useInterval } from "@visulima/tui/hooks/use-interval";
import { Digits } from "@visulima/tui-kit/digits";
import { Gauge } from "@visulima/tui-kit/gauge";
import { MultiProgress } from "@visulima/tui-kit/multi-progress";
import { TokenUsage } from "@visulima/tui-kit/token-usage";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [tick, setTick] = useState(0);

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    useInterval(() => {
        setTick((value) => value + 1);
    }, 1000);

    const input = 1200 + tick * 40;
    const output = 300 + tick * 25;
    const cpu = 40 + (tick % 40);

    return (
        <Box borderStyle="round" flexDirection="column" gap={1} paddingX={1}>
            <Text bold color="magenta">
                Agent Usage
            </Text>

            <Box flexDirection="column">
                <Text dimColor>Context window</Text>
                <TokenUsage contextLimit={200_000} input={input} output={output} />
            </Box>

            <Box flexDirection="column">
                <Text dimColor>This turn</Text>
                <TokenUsage input={input} output={output} />
            </Box>

            <Box flexDirection="column">
                <Text dimColor>Tools</Text>
                <MultiProgress
                    items={[
                        { color: "cyan", label: "read", value: Math.min(1, tick / 10) },
                        { color: "yellow", label: "edit", value: Math.min(1, tick / 20) },
                        { color: "green", label: "run", value: Math.min(1, tick / 6) },
                    ]}
                />
            </Box>

            <Box gap={4}>
                <Box flexDirection="column">
                    <Text dimColor>CPU</Text>
                    <Gauge label="cpu" size="small" value={cpu} />
                </Box>
                <Box flexDirection="column">
                    <Text dimColor>Elapsed</Text>
                    <Digits color="cyan" value={`0:${String(tick).padStart(2, "0")}`} />
                </Box>
            </Box>

            <Text dimColor>Esc to quit</Text>
        </Box>
    );
};

render(<App />);
