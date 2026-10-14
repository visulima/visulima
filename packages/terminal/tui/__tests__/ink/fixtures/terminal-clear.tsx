import React from "react";

import { Box, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import step from "./pty-step";

const Frame = () => (
    <Box flexDirection="column">
        <Text>Frame line 1</Text>
        <Text>Frame line 2</Text>
    </Box>
);

console.log("history 1");
console.log("history 2");

const { clear, rerender, unmount, waitUntilRenderFlush } = render(<Frame />);

await waitUntilRenderFlush();
await step("rendered");

clear();
console.log("printed after clear");
await waitUntilRenderFlush();
await step("cleared");

rerender(<Frame />);
await waitUntilRenderFlush();
await step("restored");

unmount();
