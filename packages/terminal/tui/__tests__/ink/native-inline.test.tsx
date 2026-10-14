import { describe, expect, it } from "vitest";

import { Box, Cursor, Static, Text } from "../../src/components/index";
import { useApp } from "../../src/ink/hooks/use-app";
import { render } from "../../src/ink/index";
import { createNative } from "../../src/ink/log-update-native";
import createStdout from "../helpers/ink-create-stdout";
import { feed, replay, resizeScreen, visibleRows } from "../helpers/ink-screen";

// The native renderer needs the compiled .node binding. Probe it once so CI without
// the binding keeps these tests skipped rather than failing.
const nativeAvailable = createNative(createStdout(20, true, 6), { inline: true }) !== undefined;

const CURSOR_SHOW = "\u001B[?25h";
const ALT_SCREEN_ON = "\u001B[?1049h";
// Absolute cursor positioning (CUP) and full-screen erase (ED 2) would move history out of reach.
// eslint-disable-next-line no-control-regex -- the escape byte is the thing being searched for
const ABSOLUTE_MOVE = /\u001B\[\d+;\d+H/u;
// eslint-disable-next-line no-control-regex -- the escape byte is the thing being searched for
const ERASE_SCREEN = /\u001B\[[23]J/u;

const COLS = 20;
const ROWS = 6;

const ttyStdout = (rows = ROWS) => createStdout(COLS, true, rows);

const lines = (count: number, offset = 0): string => Array.from({ length: count }, (_, index) => `line ${index + offset}`).join("\n");

describe("native inline renderer", () => {
    it.skipIf(!nativeAvailable)("draws the frame below the shell prompt and leaves the prompt intact", async () => {
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

    it.skipIf(!nativeAvailable)("never uses absolute positioning or clears the whole screen", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { rerender, unmount, waitUntilRenderFlush } = render(<Text>{lines(2)}</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        rerender(<Text>{lines(7)}</Text>);
        await waitUntilRenderFlush();

        rerender(<Text>{lines(1)}</Text>);
        await waitUntilRenderFlush();

        unmount();

        const output = stdout.getWrites().join("");

        expect(output).not.toMatch(ABSOLUTE_MOVE);
        expect(output).not.toMatch(ERASE_SCREEN);
        expect(replay(stdout.getWrites(), ROWS, COLS).scrollbackCleared).toBe(false);
    });

    it.skipIf(!nativeAvailable)("scrolls the terminal when the frame grows past the bottom and keeps the prompt in the scrollback", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { rerender, unmount, waitUntilRenderFlush } = render(<Text>{lines(4)}</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        // Four frame rows start on row 1, so the fifth row needs the terminal to scroll.
        rerender(<Text>{lines(5)}</Text>);
        await waitUntilRenderFlush();

        const screen = replay(stdout.getWrites(), ROWS, COLS);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["line 0", "line 1", "line 2", "line 3", "line 4"]);
        expect(screen.scrollback).toContain("$ prompt");
        expect(screen.cursorY).toBe(5);

        unmount();
    });

    it.skipIf(!nativeAvailable)("shows the bottom rows of a frame taller than the terminal", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(<Text>{lines(10)}</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        const rows = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        // One row stays free below the frame, so the terminal shows five frame rows: the bottom ones.
        expect(rows.slice(0, 5)).toEqual(["line 5", "line 6", "line 7", "line 8", "line 9"]);
        expect(rows[5]).toBe("");

        unmount();
    });

    it.skipIf(!nativeAvailable)("erases the rows a shrunk frame no longer covers", async () => {
        expect.assertions(4);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { rerender, unmount, waitUntilRenderFlush } = render(<Text>{lines(4)}</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        rerender(<Text>{lines(2)}</Text>);
        await waitUntilRenderFlush();

        const rows = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        expect(rows.slice(0, 4)).toEqual(["$ prompt", "line 0", "line 1", ""]);
        expect(rows.join("\n")).not.toContain("line 2");
        expect(rows.join("\n")).not.toContain("line 3");

        // A stale frame row would still be visible below the new frame.
        expect(rows.slice(4)).toEqual(["", ""]);

        unmount();
    });

    it.skipIf(!nativeAvailable)("parks the cursor below the frame and shows it on unmount", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        unmount();

        const screen = replay(stdout.getWrites(), ROWS, COLS);

        // The frame is on row 1, so the cursor belongs on row 2, at the start of the line.
        expect(screen.cursorY).toBe(2);
        expect(screen.cursorX).toBe(0);
        expect(stdout.getWrites().join("")).toContain(CURSOR_SHOW);
    });

    it.skipIf(!nativeAvailable)("leaves the cursor inside the frame while rendering and moves it below the frame on unmount", async () => {
        expect.assertions(4);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Text>hello</Text>
                <Cursor />
            </Box>,
            { interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        const placed = replay(stdout.getWrites(), ROWS, COLS);

        expect(stdout.getWrites().join("")).toContain(CURSOR_SHOW);
        expect([placed.cursorX, placed.cursorY]).toEqual([5, 1]);

        unmount();

        const parked = replay(stdout.getWrites(), ROWS, COLS);

        // The one-row frame is on row 1, so the cursor belongs on the row below it, at the start of the line.
        expect([parked.cursorX, parked.cursorY]).toEqual([0, 2]);
        expect(visibleRows(parked)[0]).toBe("$ prompt");
    });

    it.skipIf(!nativeAvailable)("prints console output above the inline frame without repeating the frame", async () => {
        expect.assertions(2);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        // eslint-disable-next-line no-console -- console output is what the renderer must keep above the frame
        console.log("log line");

        await waitUntilRenderFlush();

        const rows = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        expect(rows.slice(0, 3)).toEqual(["$ prompt", "log line", "hello native"]);
        expect(rows.filter((row) => row === "hello native")).toHaveLength(1);

        unmount();
    });

    it.skipIf(!nativeAvailable)("erases the inline frame while a child process owns the terminal and draws it once on resume", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();
        let suspend: (() => Promise<unknown>) | undefined;

        const Probe = () => {
            const { suspendTerminal } = useApp();

            suspend = suspendTerminal;

            return <Text>hello native</Text>;
        };

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(<Probe />, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        const suspension = (await suspend!()) as { resume: () => Promise<void> };

        expect(visibleRows(replay(stdout.getWrites(), ROWS, COLS)).join("\n")).not.toContain("hello native");

        await suspension.resume();
        await waitUntilRenderFlush();

        const rows = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        expect(rows[0]).toBe("$ prompt");
        expect(rows.filter((row) => row === "hello native")).toHaveLength(1);

        unmount();
    });

    it.skipIf(!nativeAvailable)("clear() erases the inline frame and the next render draws it again at the same place", async () => {
        expect.assertions(4);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { clear, rerender, unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        clear();

        const cleared = replay(stdout.getWrites(), ROWS, COLS);

        expect(visibleRows(cleared)).not.toContain("hello native");
        expect(cleared.cursorY).toBe(1);

        rerender(<Text>hello native</Text>);
        await waitUntilRenderFlush();

        const redrawn = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        expect(redrawn[0]).toBe("$ prompt");
        expect(redrawn[1]).toBe("hello native");

        unmount();
    });

    it.skipIf(!nativeAvailable)("keeps <Static> output above the frame and does not repeat it when more arrives", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { rerender, unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={["done one"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>hello native</Text>
            </>,
            { interactive: true, stdout, useNativeRenderer: true },
        );

        await waitUntilRenderFlush();

        rerender(
            <>
                <Static items={["done one", "done two"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>hello native</Text>
            </>,
        );
        await waitUntilRenderFlush();

        const rows = visibleRows(replay(stdout.getWrites(), ROWS, COLS));

        expect(rows.slice(0, 4)).toEqual(["$ prompt", "done one", "done two", "hello native"]);
        expect(rows.filter((row) => row === "done one")).toHaveLength(1);
        expect(rows.filter((row) => row === "hello native")).toHaveLength(1);

        unmount();
    });

    it.skipIf(!nativeAvailable)("redraws the frame at the new size and keeps the shell history", async () => {
        expect.assertions(3);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(<Text>{lines(3)}</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        // Replay what is on screen before the resize, shrink the model the way a terminal does, then replay the rest.
        const before = stdout.getWrites().length;
        const screen = replay(stdout.getWrites(), ROWS, COLS);

        stdout.rows = 4;
        stdout.emit("resize");
        await waitUntilRenderFlush();

        resizeScreen(screen, COLS, 4);
        feed(screen, stdout.getWrites().slice(before).join(""));

        const rows = visibleRows(screen);

        expect(rows.slice(0, 3)).toEqual(["line 0", "line 1", "line 2"]);
        expect(screen.scrollback).toContain("$ prompt");
        expect(rows.join("\n").match(/line 0/gu)).toHaveLength(1);

        unmount();
    });

    it.skipIf(!nativeAvailable)("never switches to the alternate screen", async () => {
        expect.assertions(1);

        const stdout = ttyStdout();

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(<Text>hello native</Text>, { interactive: true, stdout, useNativeRenderer: true });

        await waitUntilRenderFlush();

        expect(stdout.getWrites().join("")).not.toContain(ALT_SCREEN_ON);

        unmount();
    });
});
