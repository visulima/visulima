import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

// The manager reads live terminal dimensions through `terminal-size` (not from the
// fake streams below), so mock it to a fixed 80x24 viewport to keep the behavioral
// assertions deterministic regardless of the developer's real terminal geometry.
const terminalSizeMock = vi.fn<() => { columns: number; rows: number }>(() => {
    return { columns: 80, rows: 24 };
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

/**
 * Build a mock NodeJS.WriteStream backed by a PassThrough that captures
 * all writes into a string array so we can assert against the rendered
 * terminal output.
 */
const createMockStream = (): { captured: string[]; stream: NodeJS.WriteStream } => {
    const captured: string[] = [];
    const passthrough = new PassThrough();

    passthrough.on("data", (chunk: Buffer | string) => {
        captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });

    const stream = passthrough as unknown as NodeJS.WriteStream;

    Object.defineProperty(stream, "isTTY", { configurable: true, value: true });

    return { captured, stream };
};

const createManager = (): { capturedErr: string[]; capturedOut: string[]; manager: InteractiveManager } => {
    const { captured: capturedOut, stream: outStream } = createMockStream();
    const { captured: capturedError, stream: errorStream } = createMockStream();
    const stdoutHook = new InteractiveStreamHook(outStream);
    const stderrHook = new InteractiveStreamHook(errorStream);
    const manager = new InteractiveManager(stdoutHook, stderrHook);

    return { capturedErr: capturedError, capturedOut, manager };
};

describe("interactiveManager", () => {
    describe("construction", () => {
        it("should be instantiable with stream hooks", () => {
            expect.assertions(1);

            const { manager } = createManager();

            expect(manager).toBeDefined();
        });

        it("should start as not hooked, not suspended, with zero lengths", () => {
            expect.assertions(4);

            const { manager } = createManager();

            expect(manager.isHooked).toBe(false);
            expect(manager.isSuspended).toBe(false);
            expect(manager.lastLength).toBe(0);
            expect(manager.outside).toBe(0);
        });
    });

    describe("hook / unhook", () => {
        it("should return true on first hook, false on subsequent", () => {
            expect.assertions(3);

            const { manager } = createManager();

            expect(manager.hook()).toBe(true);
            expect(manager.isHooked).toBe(true);
            expect(manager.hook()).toBe(false);
        });

        it("should return false unhook when not active", () => {
            expect.assertions(1);

            const { manager } = createManager();

            expect(manager.unhook()).toBe(false);
        });

        it("should unhook after being hooked", () => {
            expect.assertions(3);

            const { manager } = createManager();

            manager.hook();

            expect(manager.unhook()).toBe(true);
            expect(manager.lastLength).toBe(0);
            expect(manager.outside).toBe(0);
        });

        it("should unhook with separateHistory=false", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();

            expect(manager.unhook(false)).toBe(true);
        });
    });

    describe("update", () => {
        it("should be a no-op when called with empty rows", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", []);

            expect(manager.lastLength).toBe(0);
        });

        it("should write rows to stdout and track lastLength", () => {
            expect.assertions(2);

            const { capturedOut, manager } = createManager();

            manager.hook();
            manager.update("stdout", ["hello", "world"]);

            expect(manager.lastLength).toBe(2);
            expect(capturedOut.join("")).toContain("hello");
        });

        it("should write rows to stderr when stream is stderr", () => {
            expect.assertions(1);

            const { capturedErr, manager } = createManager();

            manager.hook();
            manager.update("stderr", ["error msg"]);

            expect(capturedErr.join("")).toContain("error msg");
        });

        it("should erase previous lines before re-rendering", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["line 1", "line 2"]);
            manager.update("stdout", ["line 3"]);

            // After a 2-line write then a 1-line write, lastLength should reflect the new write.
            expect(manager.lastLength).toBe(1);
        });

        it("should count the position offset in lastLength for a partial update (from > 0)", () => {
            expect.assertions(2);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["a", "b", "c"]);

            expect(manager.lastLength).toBe(3);

            // Overwrite starting at line 2 with a single row. The on-screen region is still
            // position (2) + output.length (1) = 3 lines, not just the 1 written row.
            manager.update("stdout", ["X"], 2);

            expect(manager.lastLength).toBe(3);
        });

        it("should erase the full region on a redraw after a partial update", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["a", "b", "c"]);
            manager.update("stdout", ["X"], 2);

            const eraseSpy = vi.spyOn(InteractiveStreamHook.prototype, "erase");

            // A full redraw (from 0) must erase all 3 on-screen lines; a bug that stored
            // lastLength = 1 after the partial update would erase only 1, stranding a and b.
            manager.update("stdout", ["p"]);

            expect(eraseSpy).toHaveBeenCalledExactlyOnceWith(3);

            eraseSpy.mockRestore();
        });
    });

    describe("bounded-history flush coordination", () => {
        it("erases the interactive region and resets bookkeeping before an early flush", () => {
            expect.assertions(4);

            const { captured: capturedOut, stream: outStream } = createMockStream();
            const { stream: errorStream } = createMockStream();
            const stdoutHook = new InteractiveStreamHook(outStream, { maxHistory: 4 });
            const stderrHook = new InteractiveStreamHook(errorStream, { maxHistory: 4 });
            const manager = new InteractiveManager(stdoutHook, stderrHook);

            manager.hook();
            manager.update("stdout", ["frame"]);

            expect(manager.lastLength).toBe(1);

            capturedOut.length = 0;

            // Flood the hooked stream past its maxHistory so the early flush fires while the
            // frame is on screen.
            for (let index = 0; index < 6; index += 1) {
                outStream.write(`m${String(index)}`);
            }

            // The region was erased and its bookkeeping cleared so the next update() repaints
            // fresh below the flushed history instead of the flush tearing through the frame.
            expect(manager.lastLength).toBe(0);
            expect(manager.outside).toBe(0);

            // The erase escape sequence was emitted before the flushed history entries.
            const out = capturedOut.join("");

            expect(out.indexOf("[")).toBeLessThan(out.indexOf("m0"));
        });
    });

    describe("erase", () => {
        it("should not throw when erasing with default count", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["foo"]);

            expect(() => {
                manager.erase("stdout");
            }).not.toThrow();
        });

        it("should not throw when erasing zero lines", () => {
            expect.assertions(1);

            const { manager } = createManager();

            expect(() => {
                manager.erase("stdout", 0);
            }).not.toThrow();
        });
    });

    describe("suspend / resume", () => {
        it("should toggle isSuspended when calling suspend then resume", () => {
            expect.assertions(2);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["hi"]);
            manager.suspend("stdout");

            expect(manager.isSuspended).toBe(true);

            manager.resume("stdout");

            expect(manager.isSuspended).toBe(false);
        });

        it("should be a no-op to suspend twice", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.suspend("stdout");
            manager.suspend("stdout");

            expect(manager.isSuspended).toBe(true);
        });

        it("should be a no-op to resume when not suspended", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.resume("stdout");

            expect(manager.isSuspended).toBe(false);
        });

        it("should resume with explicit eraseRowCount", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["row 1", "row 2"]);
            manager.suspend("stdout");
            manager.resume("stdout", 2);

            expect(manager.isSuspended).toBe(false);
        });

        it("should suspend without erasing when erase=false", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["data"]);
            manager.suspend("stdout", false);

            expect(manager.isSuspended).toBe(true);
        });

        it("should ignore update() while suspended so external output is not overwritten", () => {
            expect.assertions(2);

            const { capturedOut, manager } = createManager();

            manager.hook();
            manager.update("stdout", ["frame"]);
            manager.suspend("stdout", false);

            capturedOut.length = 0;

            // A still-ticking renderer calling update() must be inert while suspended.
            manager.update("stdout", ["frame 2"]);

            expect(capturedOut.join("")).toBe("");
            expect(manager.lastLength).toBe(1);
        });
    });
});
