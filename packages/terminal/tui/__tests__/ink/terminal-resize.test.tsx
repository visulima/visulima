import process from "node:process";
import { describe, expect, it } from "vitest";
import delay from "delay";
import { strip as stripAnsi } from "@visulima/ansi";
import { render, Box, Text, useWindowSize } from "../../src/ink/index.js";
import createStdout, { type FakeStdout } from "../helpers/ink-create-stdout.js";

const getWriteContents = (stdout: FakeStdout): string[] => stdout.getWrites().filter((w) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));

it("useWindowSize returns current terminal dimensions and updates on resize", async () => {
    const stdout = createStdout(100);
    (stdout as any).rows = 40;

    function Test() {
        const { columns, rows } = useWindowSize();
        return (
            <Text>
                {columns}x{rows}
            </Text>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout });
    await waitUntilRenderFlush();

    expect(stripAnsi(getWriteContents(stdout).at(-1)!).includes("100x40")).toBe(true);

    (stdout as any).columns = 60;
    (stdout as any).rows = 20;
    stdout.emit("resize");
    await delay(100);

    expect(stripAnsi(getWriteContents(stdout).at(-1)!).includes("60x20")).toBe(true);
});

it("useWindowSize removes resize listener on unmount", async () => {
    const stdout = createStdout(100);
    (stdout as any).rows = 24;

    function Test() {
        const { columns, rows } = useWindowSize();
        return (
            <Text>
                {columns}x{rows}
            </Text>
        );
    }

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

    function Test() {
        const { columns, rows } = useWindowSize();
        return (
            <Text>
                {columns}x{rows}
            </Text>
        );
    }

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

    function Test() {
        const { columns } = useWindowSize();
        capturedColumns = columns;
        return <Text>{columns}</Text>;
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout });
    await waitUntilRenderFlush();

    expect(capturedColumns).toBeGreaterThan(0);
});

it("clear screen when terminal width decreases", async () => {
    const stdout = createStdout(100);

    function Test() {
        return (
            <Box borderStyle="round">
                <Text>Hello World</Text>
            </Box>
        );
    }

    render(<Test />, { stdout });

    const initialOutput = stripAnsi(getWriteContents(stdout)[0]!);
    expect(initialOutput.includes("Hello World")).toBe(true);
    expect(initialOutput.includes("╭")).toBe(true);

    stdout.columns = 50;
    stdout.emit("resize");
    await delay(100);

    const lastOutput = stripAnsi(getWriteContents(stdout).at(-1)!);
    expect(lastOutput.includes("Hello World")).toBe(true);
    expect(lastOutput.includes("╭")).toBe(true);
    expect(initialOutput).not.toBe(lastOutput);
});

it("no screen clear when terminal width increases", async () => {
    const stdout = createStdout(50);

    function Test() {
        return (
            <Box borderStyle="round">
                <Text>Test</Text>
            </Box>
        );
    }

    render(<Test />, { stdout });

    const initialOutput = getWriteContents(stdout)[0]!;

    stdout.columns = 100;
    stdout.emit("resize");
    await delay(100);

    const lastOutput = getWriteContents(stdout).at(-1)!;

    expect(stripAnsi(initialOutput)).not.toBe(stripAnsi(lastOutput));
    expect(stripAnsi(lastOutput).includes("Test")).toBe(true);
});

it("consecutive width decreases trigger screen clear each time", async () => {
    const stdout = createStdout(100);

    function Test() {
        return (
            <Box borderStyle="round">
                <Text>Content</Text>
            </Box>
        );
    }

    render(<Test />, { stdout });

    const initialOutput = stripAnsi(getWriteContents(stdout)[0]!);

    stdout.columns = 80;
    stdout.emit("resize");
    await delay(100);

    const afterFirstDecrease = stripAnsi(getWriteContents(stdout).at(-1)!);
    expect(initialOutput).not.toBe(afterFirstDecrease);
    expect(afterFirstDecrease.includes("Content")).toBe(true);

    stdout.columns = 60;
    stdout.emit("resize");
    await delay(100);

    const afterSecondDecrease = stripAnsi(getWriteContents(stdout).at(-1)!);
    expect(afterFirstDecrease).not.toBe(afterSecondDecrease);
    expect(afterSecondDecrease.includes("Content")).toBe(true);
});

it("width decrease clears lastOutput to force rerender", async () => {
    const stdout = createStdout(100);

    function Test() {
        return (
            <Box borderStyle="round">
                <Text>Test Content</Text>
            </Box>
        );
    }

    const { rerender } = render(<Test />, { stdout });

    const initialOutput = stripAnsi(getWriteContents(stdout)[0]!);

    stdout.columns = 50;
    stdout.emit("resize");
    await delay(100);

    const afterResizeOutput = stripAnsi(getWriteContents(stdout).at(-1)!);

    expect(initialOutput).not.toBe(afterResizeOutput);
    expect(afterResizeOutput.includes("Test Content")).toBe(true);

    rerender(
        <Box borderStyle="round">
            <Text>Updated Content</Text>
        </Box>,
    );
    await delay(100);

    expect(stripAnsi(getWriteContents(stdout).at(-1)!).includes("Updated Content")).toBe(true);
});
