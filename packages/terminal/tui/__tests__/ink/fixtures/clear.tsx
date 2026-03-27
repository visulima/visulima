import React from "react";
import { Box, Text, render } from "../../../src/ink/index.js";

function Clear() {
    return (
        <Box flexDirection="column">
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
        </Box>
    );
}

const { clear } = render(<Clear />);
clear();
