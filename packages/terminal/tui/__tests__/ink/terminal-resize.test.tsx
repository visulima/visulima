import { strip as stripAnsi } from "@visulima/ansi";
import delay from "delay";
import { expect, it } from "vitest";

import { Box, render, Text, useWindowSize } from "../../src/ink/index.js";
import type { FakeStdout } from "../helpers/ink-create-stdout.js";
import createStdout from "../helpers/ink-create-stdout.js";

const getWriteContents = (stdout: FakeStdout): string[] => stdout.getWrites().filter((w) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));

it("useWindowSize returns current terminal dimensions and updates on resize", async () => {
    const stdout = createStdout(100);

    (stdout as any).rows = 40;

    const Test = () => {
        const { columns, rows } = useWindowSize();

        return (
            <Text>
                {columns}
                x
                {rows}
            </Text>
        );
    };

    const { waitUntilRenderFlush } = render(<Test />, { stdout });

    await waitUntilRenderFlush();

    expect(stripAnsi(getWriteContents(stdout).at(-1)!)).toContain("100x40");

    (stdout as any).columns = 60;
    (stdout as any).rows = 20;
    stdout.emit("resize");
    await delay(100);

    expect(stripAnsi(getWriteContents(stdout).at(-1)!)).toContain("60x20");
});

it("useWindowSize removes resize listener on unmount", async () => {
    const stdout = createStdout(100);

    (stdout as any).rows = 24;

    const Test = () => {
        const { columns, rows } = useWindowSize();

        return (
            <Text>
                {columns}
                x
                {rows}
            </Text>
        );
    };

    const initialListenerCount = stdout.listenerCount("resize");
    const { unmount, waitUntilRenderFlush } = render(<Test />, { stdout });

    await waitUntilRenderFlush();

    expect(stdout.listenerCount("resize")).toBeGreaterThan(initialListenerCount);

    unmount();

    expect(stdout.listenerCount("resize")).toBe(initialListenerCount);
});

it("useWindowSize does not crash when resize fires after unmount", async () => {
    const stdout = createStdout(100);

    (stdout as any).rows = 24;

    const Test = () => {
        const { columns, rows } = useWindowSize();

        return (
            <Text>
                {columns}
                x
                {rows}
            </Text>
        );
    };

    const { unmount, waitUntilRenderFlush } = render(<Test />, { stdout });

    await waitUntilRenderFlush();
    unmount();

    stdout.emit("resize");
    await delay(50);

    expect(true).toBe(true); // No crash
});

it("useWindowSize falls back to a positive column count when stdout.columns is 0", async () => {
    const stdout = createStdout(0);
    let capturedColumns = -1;

    const Test = () => {
        const { columns } = useWindowSize();

        capturedColumns = columns;

        return <Text>{columns}</Text>;
    };

    const { waitUntilRenderFlush } = render(<Test />, { stdout });

    await waitUntilRenderFlush();

    expect(capturedColumns).toBeGreaterThan(0);
});

it("clear screen when terminal width decreases", async () => {
    const stdout = createStdout(100);

    const Test = () => (
        <Box borderStyle="round">
            <Text>Hello World</Text>
        </Box>
    );

    render(<Test />, { stdout });

    const initialOutput = stripAnsi(getWriteContents(stdout)[0]!);

    expect(initialOutput).toContain("Hello World");
    expect(initialOutput).toContain("╭");

    stdout.columns = 50;
    stdout.emit("resize");
    await delay(100);

    const lastOutput = stripAnsi(getWriteContents(stdout).at(-1)!);

    expect(lastOutput).toContain("Hello World");
    expect(lastOutput).toContain("╭");
    expect(initialOutput).not.toBe(lastOutput);
});

it("no screen clear when terminal width increases", async () => {
    const stdout = createStdout(50);

    const Test = () => (
        <Box borderStyle="round">
            <Text>Test</Text>
        </Box>
    );

    render(<Test />, { stdout });

    const initialOutput = getWriteContents(stdout)[0]!;

    stdout.columns = 100;
    stdout.emit("resize");
    await delay(100);

    const lastOutput = getWriteContents(stdout).at(-1)!;

    expect(stripAnsi(initialOutput)).not.toBe(stripAnsi(lastOutput));
    expect(stripAnsi(lastOutput)).toContain("Test");
});

it("consecutive width decreases trigger screen clear each time", async () => {
    const stdout = createStdout(100);

    const Test = () => (
        <Box borderStyle="round">
            <Text>Content</Text>
        </Box>
    );

    render(<Test />, { stdout });

    const initialOutput = stripAnsi(getWriteContents(stdout)[0]!);

    stdout.columns = 80;
    stdout.emit("resize");
    await delay(100);

    const afterFirstDecrease = stripAnsi(getWriteContents(stdout).at(-1)!);

    expect(initialOutput).not.toBe(afterFirstDecrease);
    expect(afterFirstDecrease).toContain("Content");

    stdout.columns = 60;
    stdout.emit("resize");
    await delay(100);

    const afterSecondDecrease = stripAnsi(getWriteContents(stdout).at(-1)!);

    expect(afterFirstDecrease).not.toBe(afterSecondDecrease);
    expect(afterSecondDecrease).toContain("Content");
});

it("width decrease clears lastOutput to force rerender", async () => {
    const stdout = createStdout(100);

    const Test = () => (
        <Box borderStyle="round">
            <Text>Test Content</Text>
        </Box>
    );

    const { rerender } = render(<Test />, { stdout });

    const initialOutput = stripAnsi(getWriteContents(stdout)[0]!);

    stdout.columns = 50;
    stdout.emit("resize");
    await delay(100);

    const afterResizeOutput = stripAnsi(getWriteContents(stdout).at(-1)!);

    expect(initialOutput).not.toBe(afterResizeOutput);
    expect(afterResizeOutput).toContain("Test Content");

    rerender(
        <Box borderStyle="round">
            <Text>Updated Content</Text>
        </Box>,
    );
    await delay(100);

    expect(stripAnsi(getWriteContents(stdout).at(-1)!)).toContain("Updated Content");
});
