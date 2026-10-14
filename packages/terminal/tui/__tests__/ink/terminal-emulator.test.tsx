import { afterEach, describe, expect, it } from "vitest";

import { ptyAvailable } from "../helpers/ink-run";
import type { FixtureSession, StartFixtureOptions } from "../helpers/pty-emulator";
import { startFixture } from "../helpers/pty-emulator";

// These tests run the renderer in a real pty and read the result back through @xterm/headless, so they
// check what a terminal shows rather than the escape bytes. Each fixture pauses at named steps, which
// keeps the emulator state at every assertion deterministic.

const TIMEOUT = 30_000;

const sessions: FixtureSession[] = [];

const start = (fixture: string, options: StartFixtureOptions): FixtureSession => {
    const session = startFixture(fixture, options);

    sessions.push(session);

    return session;
};

afterEach(() => {
    for (const session of sessions.splice(0)) {
        session.dispose();
    }
});

const countOf = (lines: string[], line: string): number => lines.filter((candidate) => candidate === line).length;

const history = (count: number): string[] => Array.from({ length: count }, (_, index) => `history ${String(index + 1)}`);

describe("terminal emulator: clear()", () => {
    it.skipIf(!ptyAvailable)(
        "keeps the shell history and draws the frame once after clear()",
        async () => {
            expect.assertions(3);

            const session = start("terminal-clear", { columns: 40, rows: 12 });

            await session.reachStep("rendered");

            expect(session.text()).toEqual(["history 1", "history 2", "Frame line 1", "Frame line 2"]);

            session.advance();
            await session.reachStep("cleared");

            expect(session.text()).toEqual(["history 1", "history 2", "printed after clear"]);

            session.advance();
            await session.reachStep("restored");

            expect(session.text()).toEqual(["history 1", "history 2", "printed after clear", "Frame line 1", "Frame line 2"]);
        },
        TIMEOUT,
    );
});

describe("terminal emulator: rows shrinking", () => {
    it.skipIf(!ptyAvailable)(
        "redraws the frame once and keeps the history above it",
        async () => {
            expect.assertions(1);

            const session = start("terminal-shrink", { columns: 40, rows: 12 });

            await session.reachStep("rendered");
            await session.resize(40, 5);
            session.advance();
            await session.reachStep("shrunk");

            expect(session.text()).toEqual(["history 1", "history 2", "Frame line 1", "Frame line 2", "Frame line 3"]);
        },
        TIMEOUT,
    );

    it.skipIf(!ptyAvailable)(
        "redraws a frame that sits at the bottom of the viewport",
        async () => {
            expect.assertions(1);

            const session = start("terminal-shrink", { columns: 40, env: { FIXTURE_HISTORY: "8" }, rows: 12 });

            await session.reachStep("rendered");
            await session.resize(40, 6);
            session.advance();
            await session.reachStep("shrunk");

            expect(session.text()).toEqual([...history(8), "Frame line 1", "Frame line 2", "Frame line 3"]);
        },
        TIMEOUT,
    );

    // Known defect: with <Cursor> parked inside the frame at the bottom of the viewport, xterm.js drops the
    // blank row under the cursor when the viewport shrinks. The renderer then moves down into a row that no
    // longer exists and erases one row too many, so the last history line above the frame is lost.
    // Remove `.fails` once the renderer no longer assumes that row is there.
    it.skipIf(!ptyAvailable).fails(
        "keeps the history above a frame with a parked cursor when rows shrink",
        async () => {
            expect.assertions(1);

            const session = start("terminal-shrink", { columns: 40, env: { FIXTURE_CURSOR: "1", FIXTURE_HISTORY: "8" }, rows: 12 });

            await session.reachStep("rendered");
            await session.resize(40, 6);
            session.advance();
            await session.reachStep("shrunk");

            expect(session.text()).toEqual([...history(8), "Frame line 1", "Frame line 2", "Frame line 3"]);
        },
        TIMEOUT,
    );
});

describe("terminal emulator: <Static> output", () => {
    it.skipIf(!ptyAvailable)(
        "keeps each static line once while the live region grows past the viewport",
        async () => {
            expect.assertions(6);

            const session = start("terminal-static-grow", { columns: 40, rows: 8 });

            await session.reachStep("small");
            session.advance();

            await session.reachStep("grown");

            expect(countOf(session.text(), "static-1")).toBe(1);
            expect(countOf(session.text(), "static-2")).toBe(1);

            session.advance();

            // A full-clear frame again, with a new static item: nothing already above may be written twice.
            await session.reachStep("grown-again");

            expect(countOf(session.text(), "static-1")).toBe(1);
            expect(countOf(session.text(), "static-2")).toBe(1);
            expect(countOf(session.text(), "static-3")).toBe(1);
            expect(countOf(session.text(), "live 13")).toBe(1);
        },
        TIMEOUT,
    );

    it.skipIf(!ptyAvailable).fails(
        "writes the overflowing live region once on a full-clear frame",
        async () => {
            expect.assertions(1);

            const session = start("terminal-static-grow", { columns: 40, rows: 8 });

            await session.reachStep("small");
            session.advance();
            await session.reachStep("grown");
            session.advance();
            await session.reachStep("grown-again");

            // The top of the earlier overflowing frame already scrolled into scrollback, so one copy of "live 1"
            // stays there. The current frame is the other copy; a redundant redraw would add a third.
            expect(countOf(session.text(), "live 1")).toBe(2);
        },
        TIMEOUT,
    );
});

describe("terminal emulator: cursor on exit", () => {
    it.skipIf(!ptyAvailable)(
        "leaves the next prompt on the line below the frame after unmount",
        async () => {
            expect.assertions(3);

            const session = start("terminal-exit-cursor", { columns: 40, rows: 12 });

            await session.reachStep("rendered");
            session.advance();
            await session.reachStep("exited");

            const lines = session.lines();
            const promptRow = lines.indexOf("$");

            expect(session.text()).toEqual(["Frame line 1", "Frame line 2", "Frame line 3", "$"]);
            expect(promptRow).toBe(lines.indexOf("Frame line 3") + 1);
            expect(session.cursorRow()).toBe(promptRow);
        },
        TIMEOUT,
    );
});

describe("terminal emulator: incremental rendering", () => {
    const expectedFrames = [
        ["Downloading 1/3 [#          ]", "status: starting", "footer: 0 bytes"],
        ["Downloading 2/3 [######     ]", "status: starting", "footer: 1024 bytes"],
        ["Downloading 3/3 [##########]", "status: done", "footer: 4096"],
        ["Downloading 3/3 [##########]", "status: done with warnings and a much longer message", "footer: 4096 bytes"],
        ["Download complete", "status: done"],
    ];

    const captureFrames = async (incremental: boolean): Promise<string[][]> => {
        const session = start("terminal-incremental", { columns: 80, env: { FIXTURE_INCREMENTAL: incremental ? "1" : "0" }, rows: 12 });
        const screens: string[][] = [];

        for (let index = 0; index < expectedFrames.length; index += 1) {
            await session.reachStep(`frame-${String(index)}`);
            screens.push(session.text());
            session.advance();
        }

        return screens;
    };

    it.skipIf(!ptyAvailable)(
        "leaves the same screen at every frame as a whole-frame rewrite",
        async () => {
            expect.assertions(2);

            const incremental = await captureFrames(true);
            const whole = await captureFrames(false);

            expect(whole).toEqual(expectedFrames);
            expect(incremental).toEqual(whole);
        },
        TIMEOUT * 2,
    );
});
