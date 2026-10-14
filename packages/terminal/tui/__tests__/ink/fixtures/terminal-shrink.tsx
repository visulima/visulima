import process from "node:process";

import React from "react";

import { Box, Cursor, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import step from "./pty-step";

const Frame = () => (
    <Box flexDirection="column">
        <Text>Frame line 1</Text>
        <Text>Frame line 2</Text>
        <Text>Frame line 3</Text>
        {process.env["FIXTURE_CURSOR"] === "1" ? <Cursor /> : null}
    </Box>
);

const historyCount = Number(process.env["FIXTURE_HISTORY"] ?? 2);

for (let index = 1; index <= historyCount; index += 1) {
    console.log(`history ${String(index)}`);
}

const resized = new Promise<void>((resolve) => {
    process.stdout.once("resize", () => {
        resolve();
    });
});

const { unmount, waitUntilRenderFlush } = render(<Frame />);

await waitUntilRenderFlush();
await step("rendered");

await resized;
await waitUntilRenderFlush();
await step("shrunk");

unmount();
