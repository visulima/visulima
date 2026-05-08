import React from "react";

import { Box, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

const Clear = () => (
    <Box flexDirection="column">
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
    </Box>
);

const { clear } = render(<Clear />);

clear();
