import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import InteractiveManager from "../src/interactive-manager";
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

    // Required for terminal-size to work when reading dimensions on
    // our fake streams (the manager only writes to them so this is enough).
    Object.defineProperty(stream, "columns", { configurable: true, value: 80 });
    Object.defineProperty(stream, "rows", { configurable: true, value: 24 });

    return { captured, stream };
};

const createManager = (): { capturedErr: string[]; capturedOut: string[]; manager: InteractiveManager } => {
    const { captured: capturedOut, stream: outStream } = createMockStream();
    const { captured: capturedErr, stream: errStream } = createMockStream();
    const stdoutHook = new InteractiveStreamHook(outStream);
    const stderrHook = new InteractiveStreamHook(errStream);
    const manager = new InteractiveManager(stdoutHook, stderrHook);

    return { capturedErr, capturedOut, manager };
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
    });

    describe("erase", () => {
        it("should not throw when erasing with default count", () => {
            expect.assertions(1);

            const { manager } = createManager();

            manager.hook();
            manager.update("stdout", ["foo"]);

            expect(() => manager.erase("stdout")).not.toThrow();
        });

        it("should not throw when erasing zero lines", () => {
            expect.assertions(1);

            const { manager } = createManager();

            expect(() => manager.erase("stdout", 0)).not.toThrow();
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
    });
});
