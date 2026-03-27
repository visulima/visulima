/**
 * progress-bar.tsx — <ProgressBar> component demo
 *
 * Controls:
 *   Space   pause/resume
 *   r       reset
 *   q / Esc quit
 *
 * Run: node --import @oxc-node/core/register examples/progress-bar.tsx
 */

import React, { useEffect, useState } from "react";
import { render, Box, Text, ProgressBar, useInput, useApp } from "@visulima/tui/react";

function App() {
    const { exit } = useApp();
    const [running, setRunning] = useState(true);
    const [build, setBuild] = useState(0);
    const [upload, setUpload] = useState(0);
    const [assets, setAssets] = useState(18);

    useEffect(() => {
        if (!running) return;
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
        if (input === " ") setRunning((v) => !v);
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
                Space pause/resume · r reset · q quit · status <Text color={running ? "green" : "yellow"}>{running ? "running" : "paused"}</Text>
            </Text>

            <Box borderStyle="round" borderColor="green" paddingX={2} paddingY={1} flexDirection="column" gap={1}>
                <Box flexDirection="row" gap={1}>
                    <Text dim>Build</Text>
                    <ProgressBar value={build} width={28} color="green" />
                </Box>

                <Box flexDirection="row" gap={1}>
                    <Text dim>Upload</Text>
                    <ProgressBar value={upload} width={28} completeChar="■" incompleteChar="·" bracket={false} showPercentage={false} color="yellow" />
                    <Text color="yellow">{String(upload).padStart(3)}%</Text>
                </Box>

                <Box flexDirection="row" gap={1}>
                    <Text dim>Assets</Text>
                    <ProgressBar value={assets} max={60} width={28} color="blue" />
                </Box>
            </Box>
        </Box>
    );
}

render(<App />);
