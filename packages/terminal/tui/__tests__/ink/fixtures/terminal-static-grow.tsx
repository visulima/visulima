import React from "react";

import { Box, Static, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import step from "./pty-step";

type AppProps = {
    items: string[];
    lines: number;
};

const App = ({ items, lines }: AppProps) => (
    <>
        <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>
        <Box flexDirection="column">
            {Array.from({ length: lines }, (_, index) => (
                <Text key={index}>{`live ${String(index + 1)}`}</Text>
            ))}
        </Box>
    </>
);

const { rerender, unmount, waitUntilRenderFlush } = render(<App items={["static-1", "static-2"]} lines={2} />);

await waitUntilRenderFlush();
await step("small");

// Taller than the 8-row viewport: the renderer has to take the full-clear path.
rerender(<App items={["static-1", "static-2"]} lines={12} />);
await waitUntilRenderFlush();
await step("grown");

// Still overflowing, and a new static item arrives on the full-clear frame.
rerender(<App items={["static-1", "static-2", "static-3"]} lines={13} />);
await waitUntilRenderFlush();
await step("grown-again");

unmount();
