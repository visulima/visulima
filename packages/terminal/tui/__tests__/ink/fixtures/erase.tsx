/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React from "react";

import { Box, render, Text } from "../../../src/ink/index";

const Erase = () => (
    <Box flexDirection="column">
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
    </Box>
);

process.stdout.rows = Number(process.argv[2]);
render(<Erase />);
