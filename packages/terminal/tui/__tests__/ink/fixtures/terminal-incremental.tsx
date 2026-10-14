import process from "node:process";

import React from "react";

import { Box, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import step from "./pty-step";

// Each frame changes part of a line: a counter, a suffix, a shorter tail, a line that grows, a
// line count that drops. Incremental mode must leave the same screen as a whole-frame rewrite.
const frames: string[][] = [
    ["Downloading 1/3 [#          ]", "status: starting", "footer: 0 bytes"],
    ["Downloading 2/3 [######     ]", "status: starting", "footer: 1024 bytes"],
    ["Downloading 3/3 [##########]", "status: done", "footer: 4096"],
    ["Downloading 3/3 [##########]", "status: done with warnings and a much longer message", "footer: 4096 bytes"],
    ["Download complete", "status: done"],
];

const Frame = ({ lines }: { lines: string[] }) => (
    <Box flexDirection="column">
        {lines.map((line, index) => (
            <Text key={index}>{line}</Text>
        ))}
    </Box>
);

const incrementalRendering = process.env["FIXTURE_INCREMENTAL"] === "1";

const { rerender, unmount, waitUntilRenderFlush } = render(<Frame lines={frames[0]!} />, { incrementalRendering });

await waitUntilRenderFlush();
await step("frame-0");

for (const [index, lines] of frames.slice(1).entries()) {
    rerender(<Frame lines={lines} />);
    await waitUntilRenderFlush();
    await step(`frame-${String(index + 1)}`);
}

unmount();
