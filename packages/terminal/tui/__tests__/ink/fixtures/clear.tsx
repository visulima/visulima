/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import React from "react";

import { Box, render, Text } from "../../../src/ink/index.js";

const Clear = () => (
    <Box flexDirection="column">
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
    </Box>
);

const { clear } = render(<Clear />);

clear();
