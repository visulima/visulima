/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React, { useEffect } from "react";

import { Box, render, Text, useApp } from "../../../src/ink/index";

const Fullscreen = () => {
    const { exit } = useApp();

    useEffect(() => {
        // Exit after first render to check the output
        const timer = setTimeout(() => {
            exit();
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [exit]);

    // Force the root to occupy exactly terminal rows
    const rows = Number(process.argv[2]) || 5;

    return (
        <Box flexDirection="column" height={rows}>
            <Box flexGrow={1}>
                <Text>Full-screen: top</Text>
            </Box>
            <Text>Bottom line (should be usable)</Text>
        </Box>
    );
};

// Set terminal size from argument
process.stdout.rows = Number(process.argv[2]) || 5;

render(<Fullscreen />);
