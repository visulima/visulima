import { PassThrough } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

// The interactive manager reads the live terminal dimensions through
// `terminal-size`. To exercise the overflow / scrolling branches of
// `update()` deterministically we mock it to report a tiny viewport so the
// rendered content is always taller than the terminal.
const terminalSizeMock = vi.fn<() => { columns: number; rows: number }>(() => {
    return { columns: 80, rows: 3 };
});

vi.mock("terminal-size", () => {
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
        // `from > height` true branch.

        expect(() => {
            manager.update("stdout", makeRows(4), 50);
        }).not.toThrow();
    });
});
