/* eslint-disable sonarjs/pseudo-random -- demo data only, no security implications */

/**
 * sparkline.tsx — inline mini-chart using Unicode blocks
 *
 * Run: node --import @oxc-node/core/register examples/sparkline.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useInterval } from "@visulima/tui/hooks/use-interval";
import { Sparkline } from "@visulima/tui-kit/sparkline";
import React, { useState } from "react";

const MAX_SAMPLES = 30;

const App = () => {
    const { exit } = useApp();
    const [samples, setSamples] = useState<ReadonlyArray<number>>(() => Array.from({ length: MAX_SAMPLES }, () => 50 + Math.random() * 50));

    useInterval(() => {
        setSamples((current) => [...current.slice(1), 20 + Math.random() * 80]);
    }, 200);

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Sparkline (live)
            </Text>
            <Box gap={1}>
                <Text>CPU</Text>
                <Sparkline color="green" data={samples} />
            </Box>
            <Text dimColor>Press Esc to quit.</Text>
        </Box>
    );
};

render(<App />);
