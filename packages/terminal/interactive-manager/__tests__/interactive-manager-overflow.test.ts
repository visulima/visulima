import { PassThrough } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

// The interactive manager reads the live terminal dimensions through
// `terminal-size`. To exercise the overflow / scrolling branches of
// `update()` deterministically we mock it to report a tiny viewport so the
// rendered content is always taller than the terminal.
const terminalSizeMock = vi.fn<() => { columns: number; rows: number }>(() => {
    return { columns: 80, rows: 3 };
});

vi.mock(import("terminal-size"), () => {
    return {
        default: () => terminalSizeMock(),
    };
});

// eslint-disable-next-line import/first
import InteractiveManager from "../src/interactive-manager";
// eslint-disable-next-line import/first
import InteractiveStreamHook from "../src/interactive-stream-hook";

const createMockStream = (): { captured: string[]; stream: NodeJS.WriteStream } => {
    const captured: string[] = [];
    const passthrough = new PassThrough();

    passthrough.on("data", (chunk: Buffer | string) => {
        captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });

    const stream = passthrough as unknown as NodeJS.WriteStream;

    Object.defineProperty(stream, "columns", { configurable: true, value: 80 });
    Object.defineProperty(stream, "rows", { configurable: true, value: 3 });
    Object.defineProperty(stream, "isTTY", { configurable: true, value: true });

    return { captured, stream };
};

const createManager = (): { capturedOut: string[]; manager: InteractiveManager } => {
    const { captured: capturedOut, stream: outStream } = createMockStream();
    const { stream: errorStream } = createMockStream();
    const stdoutHook = new InteractiveStreamHook(outStream);
    const stderrHook = new InteractiveStreamHook(errorStream);
    const manager = new InteractiveManager(stdoutHook, stderrHook);

    return { capturedOut, manager };
};

const makeRows = (count: number): string[] => Array.from({ length: count }, (_, index) => `row ${String(index)}`);

describe("interactiveManager overflow (height <= actualLength)", () => {
    beforeEach(() => {
        terminalSizeMock.mockReturnValue({ columns: 80, rows: 3 });
    });

    it("tracks outside rows when content exceeds the terminal height", () => {
        expect.assertions(2);

        const { manager } = createManager();

        manager.hook();
        // 10 rows into a 3-row terminal: nothing overflowed yet (no prior length),
        // but lastLength/outside should now reflect the oversized write.
        manager.update("stdout", makeRows(10));

        // outside === lastLength - height === 10 - 3 === 7
        expect(manager.outside).toBe(7);
        expect(manager.lastLength).toBe(10);
    });

    it("erases a full viewport and slices off scrolled-away rows when position < outside", () => {
        expect.assertions(2);

        const { manager } = createManager();

        manager.hook();
        // First write builds up lastLength = 10, outside = 7.
        manager.update("stdout", makeRows(10));
        // Second write: actualLength (10) >= height (3) -> erase(height) path,
        // and position (0) < outside (7) -> slice the freshly wrapped output.
        manager.update("stdout", makeRows(5));

        // outside stays at its running max (7); lastLength === outside + output.length + 1.
        expect(manager.outside).toBe(7);
        expect(manager.lastLength).toBeGreaterThan(0);
    });

    it("erases a full viewport without slicing when position is not less than outside", () => {
        expect.assertions(2);

        const { manager } = createManager();

        manager.hook();
        // Exactly fill the viewport so outside stays 0 (lastLength === height).
        manager.update("stdout", makeRows(3));
        // Second write: actualLength (3) >= height (3) -> erase(height),
        // but position (0) is NOT < outside (0) -> the slice branch is skipped.
        manager.update("stdout", makeRows(3));

        expect(manager.outside).toBe(0);
        // outside falsy -> lastLength === output.length.
        expect(manager.lastLength).toBe(3);
    });

    it("clamps position to the last row when `from` exceeds the terminal height", () => {
        expect.assertions(1);

        const { manager } = createManager();

        manager.hook();
        manager.update("stdout", makeRows(10));
        // from (50) > height (3) -> position clamps to height - 1, exercising the
        // clamp upper bound.

        expect(() => {
            manager.update("stdout", makeRows(4), 50);
        }).not.toThrow();
    });
});

describe("interactiveManager wrapped-row bookkeeping", () => {
    beforeEach(() => {
        // Wide enough viewport (rows) so we exercise the wrap path, not the overflow path.
        terminalSizeMock.mockReturnValue({ columns: 10, rows: 50 });
    });

    it("counts visual lines, not logical rows, when a row exceeds terminal width", () => {
        expect.assertions(1);

        const { manager } = createManager();

        manager.hook();
        // A single 30-char row in a 10-column terminal wraps to 3 visual lines.
        manager.update("stdout", ["x".repeat(30)]);

        // Previously this reported 1 (input row count); it must now report the 3 wrapped lines.
        expect(manager.lastLength).toBe(3);
    });

    it("sums wrapped visual lines across multiple rows", () => {
        expect.assertions(1);

        const { manager } = createManager();

        manager.hook();
        // Two rows: a 20-char row (2 lines) + a short row (1 line) = 3 visual lines.
        manager.update("stdout", ["y".repeat(20), "short"]);

        expect(manager.lastLength).toBe(3);
    });
});

describe("interactiveManager clear / done / empty update", () => {
    beforeEach(() => {
        terminalSizeMock.mockReturnValue({ columns: 80, rows: 24 });
    });

    it("clear() wipes the region and resets bookkeeping", () => {
        expect.assertions(2);

        const { manager } = createManager();

        manager.hook();
        manager.update("stdout", ["a", "b", "c"]);

        expect(manager.lastLength).toBe(3);

        manager.clear("stdout");

        expect(manager.lastLength).toBe(0);
    });

    it("update() with an empty array clears the region", () => {
        expect.assertions(2);

        const { manager } = createManager();

        manager.hook();
        manager.update("stdout", ["a", "b"]);

        expect(manager.lastLength).toBe(2);

        manager.update("stdout", []);

        expect(manager.lastLength).toBe(0);
    });

    it("done() resets bookkeeping without erasing on-screen output", () => {
        expect.assertions(2);

        const { capturedOut, manager } = createManager();

        manager.hook();
        manager.update("stdout", ["final frame"]);

        const before = capturedOut.join("");

        manager.done("stdout");

        // No additional erase sequence was emitted by done().
        expect(capturedOut.join("")).toBe(before);
        expect(manager.lastLength).toBe(0);
    });
});
