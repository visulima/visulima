/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React, { useEffect } from "react";

import { Box, render, Text, useApp } from "../../../src/ink/index.js";

const App = () => {
    const { exit } = useApp();

    useEffect(() => {
        const timer = setTimeout(() => {
            exit();
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [exit]);

    const rows = Number(process.argv[2]) || 5;
    const columns = process.stdout.columns || 100;

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box flexGrow={1}>
                <Text>#442 top</Text>
            </Box>
            <Text>#442 bottom</Text>
        </Box>
    );
};

process.stdout.rows = Number(process.argv[2]) || 5;

render(<App />);
