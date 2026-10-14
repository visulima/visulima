import { describe, expect, it } from "vitest";

import { Box, Cursor, Static, Text } from "../../src/components/index";
import { useApp } from "../../src/ink/hooks/use-app";
import { render } from "../../src/ink/index";
import { createNative } from "../../src/ink/log-update-native";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import { replay, visibleRows } from "../helpers/ink-screen";

// The native renderer needs the compiled .node binding. Probe it once so CI without
// the binding keeps these tests skipped rather than failing.
const nativeAvailable = createNative(createStdout(20, true, 6)) !== undefined;

const ALT_SCREEN_ON = "\u001B[?1049h";
const ALT_SCREEN_OFF = "\u001B[?1049l";
const CURSOR_HIDE = "\u001B[?25l";
const CURSOR_SHOW = "\u001B[?25h";
const BAR_CURSOR = "\u001B[6 q";
const DEFAULT_CURSOR = "\u001B[0 q";
const COLS = 20;
const ROWS = 6;

const ttyStdout = () => createStdout(COLS, true, ROWS);

describe("native renderer", () => {
    it.skipIf(!nativeAvailable)("writes frames to the stdout the app renders to", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        expect(stdout.getWrites().join("")).toContain(ALT_SCREEN_ON);
        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toContain("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("does not position the cursor when stdout is not a TTY", () => {
        expect.assertions(2);

        const stdout = createStdout(COLS, false, ROWS);

        const { unmount } = render(<Text>hello native</Text>, { stdout, useNativeRenderer: true });

        unmount();

        const output = stdout.getWrites().join("");

        expect(output).toContain("hello native");
        // eslint-disable-next-line no-control-regex -- the escape byte is the thing being searched for
        expect(output).not.toMatch(/\u001B\[\d+;\d+H/u);
    });

    it.skipIf(!nativeAvailable)("leaves shell output above an inline frame intact", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        const rows = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        expect(rows[0]).toBe("$ prompt");
        expect(rows[1]).toBe("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("clear() erases the frame and rerendering draws it again", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        const { clear, rerender, unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        clear();

        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS)).join("")).not.toContain("hello native");

        rerender(<Text>hello native</Text>);
        await waitUntilRenderFlush();

        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toContain("hello native");

        unmount();

        expect(stdout.getWrites().join("")).toContain(ALT_SCREEN_OFF);
    });

    it.skipIf(!nativeAvailable)("does not write the last frame after leaving the alternate screen", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();

        const { unmount, waitUntilExit, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        unmount();
        await waitUntilExit();

        const output = stdout.getWrites().join("");
        const afterScreenOff = output.slice(output.lastIndexOf(ALT_SCREEN_OFF));

        expect(afterScreenOff).not.toContain("hello native");
        expect(afterScreenOff).toContain(CURSOR_SHOW);
    });

    it.skipIf(!nativeAvailable)("calls onRender once the frame has reached stdout", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();
        const seen: boolean[] = [];

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            onRender: () => {
                seen.push(stdout.getWrites().join("").includes("hello native"));
            },
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        expect(seen.length).toBeGreaterThan(0);
        expect(seen.every(Boolean)).toBe(true);

        unmount();
    });

    it.skipIf(!nativeAvailable)("redraws the frame after the terminal loses rows", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        const before = stdout.getWrites().length;

        stdout.rows = ROWS - 2;
        stdout.emit("resize");

        await waitUntilRenderFlush();

        // The diff only carries cells that changed, so replay what was written after the shrink onto a blank screen.
        expect(visibleRows(replay(stdout.getWrites().slice(before), ROWS, COLS))).toContain("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("accepts incrementalRendering without changing the frame", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        const { rerender, unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Text>first</Text>
                <Text>second</Text>
            </Box>,
            { alternateScreen: true, incrementalRendering: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        rerender(
            <Box flexDirection="column">
                <Text>first</Text>
                <Text>changed</Text>
            </Box>,
        );
        await waitUntilRenderFlush();

        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS)).slice(0, 2)).toEqual(["first", "changed"]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("places the terminal cursor at <Cursor> and shows it", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Text>hello</Text>
                <Cursor />
            </Box>,
            { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        const screen = replay(stdout.getWrites(), ROWS, COLS);

        expect(stdout.getWrites().join("")).toContain(CURSOR_HIDE);
        expect(stdout.getWrites().join("")).toContain(CURSOR_SHOW);
        expect([screen.cursorX, screen.cursorY]).toEqual([5, 0]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("redraws the frame when the terminal resumes from suspension", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();
        let suspend: (() => Promise<unknown>) | undefined;

        const Probe = () => {
            const { suspendTerminal } = useApp();

            suspend = suspendTerminal;

            return <Text>hello native</Text>;
        };

        const { unmount, waitUntilRenderFlush } = render(<Probe />, { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        const before = stdout.getWrites().length;

        const suspension = (await suspend!()) as { resume: () => Promise<void> };

        await suspension.resume();
        await waitUntilRenderFlush();

        expect(visibleRows(replay(stdout.getWrites().slice(before), ROWS, COLS))).toContain("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("keeps the frame intact when console output is written", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        // eslint-disable-next-line no-console -- console output is what the renderer must survive
        console.log("log line");

        await waitUntilRenderFlush();

        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toContain("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("keeps the native frame free of stray newlines after console output", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        const before = stdout.getWrites().length;

        // eslint-disable-next-line no-console -- console output is what the renderer must survive
        console.log("log line");

        await waitUntilRenderFlush();

        // Only the console's own line may carry a newline; a string-path restore would add a bare one and scroll the alternate screen.
        expect(stdout.getWrites().slice(before).join("").replace("log line\n", "")).not.toContain("\n");

        unmount();
    });

    it.skipIf(!nativeAvailable)("enables and restores the kitty keyboard protocol around native frames", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();
        const stdin = createStdin();

        Object.assign(stdin, { isTTY: true });

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            kittyKeyboard: { mode: "enabled" },
            stdin,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        expect(stdout.getWrites().join("")).toContain("\u001B[>1u");
        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toContain("hello native");

        unmount();

        expect(stdout.getWrites().join("")).toContain("\u001B[<u");
    });

    it.skipIf(!nativeAvailable)("keeps <Static> output above the native frame", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={["done one"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>hello native</Text>
            </>,
            { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        const rows = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        expect(rows[0]).toBe("done one");
        expect(rows[1]).toBe("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("replays <Static> output on alternate-screen resume with the native frame below it", async () => {
        expect.assertions(4);

        const stdout = ttyStdout();
        let suspend: (() => Promise<unknown>) | undefined;

        const Probe = () => {
            const { suspendTerminal } = useApp();

            suspend = suspendTerminal;

            return (
                <>
                    <Static items={["done one"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                    <Text>hello native</Text>
                </>
            );
        };

        const { unmount, waitUntilRenderFlush } = render(<Probe />, { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        const before = stdout.getWrites().length;
        const suspension = (await suspend!()) as { resume: () => Promise<void> };

        await suspension.resume();
        await waitUntilRenderFlush();

        // The alternate screen comes back blank: static output and the frame must both be drawn again,
        // with the static block written from home rather than wherever the cursor was left.
        const writes = stdout.getWrites().slice(before);
        const staticWrite = writes.find((chunk) => chunk.includes("done one")) ?? "";

        expect(staticWrite.indexOf("\u001B[H")).toBeGreaterThanOrEqual(0);
        expect(staticWrite.indexOf("\u001B[H")).toBeLessThan(staticWrite.indexOf("done one"));

        const rows = visibleRows(replay(writes, ROWS, COLS));

        expect(rows[0]).toBe("done one");
        expect(rows[1]).toBe("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("keeps earlier <Static> items when new ones arrive", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();
        const renderStatic = (items: string[]) => (
            <>
                <Static items={items}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>hello native</Text>
            </>
        );

        const { rerender, unmount, waitUntilRenderFlush } = render(renderStatic(["first"]), {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        rerender(renderStatic(["first", "second"]));
        await waitUntilRenderFlush();

        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS)).slice(0, 3)).toEqual(["first", "second", "hello native"]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("clips a frame taller than the terminal instead of wrapping it", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={["s1", "s2", "s3"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Box flexDirection="column">
                    <Text>l1</Text>
                    <Text>l2</Text>
                    <Text>l3</Text>
                    <Text>l4</Text>
                    <Text>l5</Text>
                    <Text>l6</Text>
                    <Text>l7</Text>
                    <Text>l8</Text>
                </Box>
            </>,
            { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        // The frame fills the terminal, so no static lines fit above it. Its last rows are dropped instead of wrapping onto the bottom row.
        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toEqual(["l1", "l2", "l3", "l4", "l5", "l6"]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("places the terminal cursor below <Static> output", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={["s1", "s2"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Box flexDirection="column">
                    <Text>hello</Text>
                    <Cursor />
                </Box>
            </>,
            { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        const screen = replay(stdout.getWrites(), ROWS, COLS);

        expect([screen.cursorX, screen.cursorY]).toEqual([5, 2]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("keeps the live frame when <Static> output fills the terminal", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();
        const items = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

        const { unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={items}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>hello native</Text>
            </>,
            { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        // The alternate screen keeps no scrollback, so only the newest static lines that fit above the frame are drawn.
        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toEqual(["s4", "s5", "s6", "s7", "s8", "hello native"]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("writes <Static> output inside the frame's synchronized update", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={["done one"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>hello native</Text>
            </>,
            { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        const writes = stdout.getWrites();
        const staticAt = writes.findIndex((chunk) => chunk.includes("done one"));

        expect(writes[staticAt - 1]).toBe("\u001B[?2026h");
        expect(writes[staticAt + 1]).toBe("\u001B[?2026l");

        unmount();
    });

    it.skipIf(!nativeAvailable)("applies <Cursor shape> once and restores the default shape on unmount", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        const { rerender, unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Text>hello</Text>
                <Cursor shape="bar" />
            </Box>,
            { alternateScreen: true, interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        expect(stdout.getWrites().join("")).toContain(BAR_CURSOR);

        rerender(
            <Box flexDirection="column">
                <Text>again</Text>
                <Cursor shape="bar" />
            </Box>,
        );
        await waitUntilRenderFlush();

        // The shape is only written when it changes, not on every frame.
        expect(stdout.getWrites().join("").split(BAR_CURSOR)).toHaveLength(2);

        unmount();

        const output = stdout.getWrites().join("");

        expect(output.lastIndexOf(DEFAULT_CURSOR)).toBeGreaterThan(output.lastIndexOf(BAR_CURSOR));
    });

    it.skipIf(!nativeAvailable)("writes only the new <Static> rows per item as the log grows", async () => {
        expect.assertions(4);

        // A tall terminal so the static block is still short at item 5 and long by item 200.
        const stdout = createStdout(COLS, true, 40);
        const renderLog = (count: number) => (
            <>
                <Static items={Array.from({ length: count }, (_, index) => `item ${index + 1}`)}>
                    {(item: string) => <Text key={item}>{item}</Text>}
                </Static>
                <Text>hello native</Text>
            </>
        );

        const { rerender, unmount, waitUntilRenderFlush } = render(renderLog(4), {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        const bytesForItem = async (count: number): Promise<number> => {
            const before = stdout.getWrites().length;

            rerender(renderLog(count));
            await waitUntilRenderFlush();

            return stdout.getWrites().slice(before).join("").length;
        };

        const early = await bytesForItem(5);

        for (let count = 6; count < 200; count += 1) {
            await bytesForItem(count);
        }

        const late = await bytesForItem(200);

        expect(late).toBeLessThan(early * 2);

        const rows = visibleRows(replay(stdout.getWrites(), 40, COLS));

        // Earlier items scroll off the top of the alternate screen; the newest one sits right above the frame.
        expect(rows[0]).toBe("item 162");
        expect(rows[38]).toBe("item 200");
        expect(rows[39]).toBe("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("draws multi-line console output above the native frame without leftovers", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        // eslint-disable-next-line no-console -- console output is what the renderer must survive
        console.log("log line\nsecond line");

        await waitUntilRenderFlush();

        // The text lands above the frame and the frame moves below it; no row of the old frame position keeps a stray line.
        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toEqual(["log line", "second line", "hello native", "", "", ""]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("draws console.error output above the native frame", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();
        const stderr = ttyStdout();

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, {
            alternateScreen: true,
            interactive: true,
            stderr,
            stdout,
            useNativeRenderer: true,
        });

        await waitUntilRenderFlush();

        // eslint-disable-next-line no-console -- console output is what the renderer must survive
        console.error("error line");

        await waitUntilRenderFlush();

        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS))).toEqual(["error line", "hello native", "", "", "", ""]);

        unmount();
    });
});
