import process from "node:process";

import React from "react";

import { Box, Cursor, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import step from "./pty-step";

// The <Cursor> parks the terminal cursor inside the frame, not on its last row.
const Frame = () => (
    <Box flexDirection="column">
        <Text>Frame line 1</Text>
        <Cursor />
        <Text>Frame line 2</Text>
        <Text>Frame line 3</Text>
    </Box>
);

const { unmount, waitUntilRenderFlush } = render(<Frame />);

await waitUntilRenderFlush();
await step("rendered");

unmount();

// What a shell would print next, once the app has handed the terminal back.
process.stdout.write("$ ");
await step("exited");
