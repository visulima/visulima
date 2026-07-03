/* eslint-disable @typescript-eslint/no-confusing-void-expression, jsdoc/lines-before-block */
/**
 * progress-bar.tsx — &lt;ProgressBar> component demo
 *
 * Controls:
 *   Space   pause/resume
 *   r       reset
 *   q / Esc quit
 *
 * Run: node --import @oxc-node/core/register examples/progress-bar.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { ProgressBar } from "@visulima/tui/components/progress-bar";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useEffect, useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [running, setRunning] = useState(true);
    const [build, setBuild] = useState(0);
    const [upload, setUpload] = useState(0);
    const [assets, setAssets] = useState(18);

    useEffect(() => {
        if (!running) {
            return;
        }

        const t = setInterval(() => {
            setBuild((p) => (p >= 100 ? 0 : p + 1));
            setUpload((p) => (p >= 100 ? 0 : p + 2));
            setAssets((p) => (p >= 60 ? 0 : p + 1));
        }, 80);

        return () => clearInterval(t);
    }, [running]);

    useInput((input, key) => {
        if (key.escape || input === "q" || (key.ctrl && input === "c")) {
            exit();

            return;
        }

        if (input === " ") {
            setRunning((v) => !v);
        }

        if (input === "r") {
            setBuild(0);
            setUpload(0);
            setAssets(0);
        }
    });

    return (
        <Box flexDirection="column" gap={1}>
            <Text bold color="cyan">
                ProgressBar demo
            </Text>
            <Text dim>
                Space pause/resume · r reset · q quit · status
{" "}
<Text color={running ? "green" : "yellow"}>{running ? "running" : "paused"}</Text>
            </Text>

            <Box borderColor="green" borderStyle="round" flexDirection="column" gap={1} paddingX={2} paddingY={1}>
                <Box flexDirection="row" gap={1}>
                    <Text dim>Build</Text>
                    <ProgressBar color="green" value={build} width={28} />
                </Box>

                <Box flexDirection="row" gap={1}>
                    <Text dim>Upload</Text>
                    <ProgressBar bracket={false} color="yellow" completeChar="■" incompleteChar="·" showPercentage={false} value={upload} width={28} />
                    <Text color="yellow">
{String(upload).padStart(3)}
%
                    </Text>
                </Box>

                <Box flexDirection="row" gap={1}>
                    <Text dim>Assets</Text>
                    <ProgressBar color="blue" max={60} value={assets} width={28} />
                </Box>
            </Box>
        </Box>
    );
};

render(<App />);
