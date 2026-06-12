/* eslint-disable vitest/prefer-called-with */
import type { InteractiveManager } from "@visulima/interactive-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSpinner, spinnerPromise } from "../src/helpers";
import { MultiSpinner, Spinner } from "../src/spinner";

/**
 * Build a mock InteractiveManager that records every `update` call so tests can
 * assert on the rendered rows.
 */
const createMockManager = (): {
    erase: ReturnType<typeof vi.fn>;
    hook: ReturnType<typeof vi.fn>;
    unhook: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updates: string[][];
} => {
    const updates: string[][] = [];

    return {
        // eslint-disable-next-line vitest/require-mock-type-parameters
        erase: vi.fn(),
        // eslint-disable-next-line vitest/require-mock-type-parameters
        hook: vi.fn().mockReturnValue(true),
        // eslint-disable-next-line vitest/require-mock-type-parameters
        unhook: vi.fn().mockReturnValue(true),
        // eslint-disable-next-line vitest/require-mock-type-parameters
        update: vi.fn((_, rows: string[]) => {
            updates.push(rows);
        }),
        updates,
    };
};

const UNKNOWN_SPINNER_RE = /Unknown spinner "nope"/;
const SUGGESTS_DOTS_RE = /dots/;

describe("constructor validation", () => {
    it("should throw a helpful error for an unknown spinner name", () => {
        expect.assertions(2);

        const construct = () => new Spinner({ name: "nope" as never });

        expect(construct).toThrow(UNKNOWN_SPINNER_RE);
        expect(construct).toThrow(SUGGESTS_DOTS_RE);
    });

    it("should accept a custom frame set without registering it in the catalog", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ frames: { frames: ["A", "B", "C"], interval: 50 } }, manager as unknown as InteractiveManager);

        spinner.start("Custom");

        const firstRow = manager.updates.at(0)?.[0];

        expect(firstRow).toBe("A Custom");

        spinner.succeed();
    });

    it("should prefer custom frames over name", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ frames: { frames: ["Z"], interval: 50 }, name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start();

        expect(manager.updates.at(0)?.[0]).toBe("Z");

        spinner.succeed();
    });
});

describe("standalone mode", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should write directly to the provided stream", () => {
        expect.assertions(1);

        const written: string[] = [];
        const stream = {
            isTTY: false,
            write: (chunk: string) => {
                written.push(chunk);

                return true;
            },
        } as unknown as NodeJS.WriteStream;

        const spinner = new Spinner({ name: "dots", stream });

        spinner.start("Loading");
        spinner.succeed("Done");

        expect(written.join("")).toContain("Done");
    });

    it("should unref the animation timer so it never holds the event loop open", () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/require-mock-type-parameters
        const unref = vi.fn();
        const originalSetInterval = globalThis.setInterval;

        // Intercept setInterval to assert .unref() is invoked on the handle.
        vi.spyOn(globalThis, "setInterval").mockImplementation(((...arguments_: Parameters<typeof setInterval>) => {
            const handle = originalSetInterval(...arguments_);

            (handle as unknown as { unref: () => void }).unref = unref;

            return handle;
        }) as typeof setInterval);

        // Use a manager so animation runs regardless of the host TTY/CI environment.
        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");

        expect(unref).toHaveBeenCalled();

        spinner.stop();
        vi.restoreAllMocks();
    });

    it("should not start an animation timer on a non-TTY stream", () => {
        expect.assertions(1);

        const stream = {
            isTTY: false,
            write: () => true,
        } as unknown as NodeJS.WriteStream;

        const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

        const spinner = new Spinner({ name: "dots", stream });

        spinner.start("Loading");

        expect(setIntervalSpy).not.toHaveBeenCalled();

        spinner.succeed();
        vi.restoreAllMocks();
    });

    it("should render frames to the stream and unref the timer with no manager on a TTY", () => {
        expect.assertions(3);

        const written: string[] = [];
        // A TTY stream makes the standalone path animate (and start a timer) without a manager.
        const stream = {
            isTTY: true,
            write: (chunk: string) => {
                written.push(chunk);

                return true;
            },
        } as unknown as NodeJS.WriteStream;

        // eslint-disable-next-line vitest/require-mock-type-parameters
        const unref = vi.fn();
        const originalSetInterval = globalThis.setInterval;

        // Intercept setInterval to assert .unref() is invoked on the handle.
        vi.spyOn(globalThis, "setInterval").mockImplementation(((...arguments_: Parameters<typeof setInterval>) => {
            const handle = originalSetInterval(...arguments_);

            (handle as unknown as { unref: () => void }).unref = unref;

            return handle;
        }) as typeof setInterval);

        // No second constructor argument => standalone, direct-stream rendering.
        const spinner = new Spinner({ frames: { frames: ["A", "B"], interval: 50 }, stream });

        spinner.start("Loading");

        // (a) the current frame is written straight to the provided stream.
        expect(written.join("")).toContain("A Loading");
        // (b) the animation timer was unref'd so it can't hold the event loop open.
        expect(unref).toHaveBeenCalled();

        // Advancing the timer keeps rendering frames in place via the same stream.
        vi.advanceTimersByTime(50);

        expect(written.join("")).toContain("B Loading");

        spinner.succeed("Done");
        vi.restoreAllMocks();
    });
});

describe("plain stop and stopAndPersist", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should stop without printing a status icon", () => {
        expect.assertions(2);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        spinner.stop();

        expect(spinner.isRunning).toBe(false);
        expect(manager.erase).toHaveBeenCalled();
    });

    it("should persist a custom symbol and text via stopAndPersist", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        manager.updates.length = 0;

        spinner.stopAndPersist({ symbol: "→", text: "Persisted" });

        expect(manager.updates.at(-1)?.[0]).toBe("→ Persisted");
    });

    it("should keep current text when stopAndPersist has no overrides", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Keep me");
        manager.updates.length = 0;

        spinner.stopAndPersist();

        expect(manager.updates.at(-1)?.[0]).toBe("Keep me");
    });
});

describe("multiSpinner does not force-succeed children on stop", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should not re-render (and so not force-succeed) children when the group stops", () => {
        expect.assertions(3);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" }, manager as unknown as InteractiveManager);
        const ok = multi.create("Task ok");
        const bad = multi.create("Task bad");

        ok.start();
        bad.start();

        ok.succeed("ok done");
        const failSpy = vi.spyOn(bad, "succeed");

        bad.failed("bad failed");

        // The last render before stop must carry the error icon for the failed child.
        const lastBeforeStop = manager.updates.at(-1) ?? [];

        expect(lastBeforeStop.some((line) => line.includes("bad failed"))).toBe(true);

        manager.updates.length = 0;
        multi.stop();

        // stop() must not produce a new render (the old code force-succeeded every child).
        expect(manager.updates).toHaveLength(0);
        expect(failSpy).not.toHaveBeenCalled();
    });

    it("should drive all children from a single shared timer", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" }, manager as unknown as InteractiveManager);
        const a = multi.create("A");
        const b = multi.create("B");

        a.start();
        b.start();

        const before = manager.update.mock.calls.length;

        // One interval tick should produce exactly one batched redraw for both spinners.
        vi.advanceTimersByTime(80);

        const calls = manager.update.mock.calls.length - before;

        // A single shared timer => one update call per tick, not one-per-spinner.
        expect(calls).toBe(1);

        multi.stop();
    });
});

describe("createSpinner factory", () => {
    it("should create a spinner with the provided text", () => {
        expect.assertions(2);

        const spinner = createSpinner("Hello", { name: "dots" });

        expect(spinner).toBeInstanceOf(Spinner);
        expect(spinner.text).toBe("Hello");
    });
});

describe("spinnerPromise helper", () => {
    it("should resolve and succeed with successText", async () => {
        expect.assertions(2);

        const manager = createMockManager();

        const result = await spinnerPromise(Promise.resolve(42), { successText: "done", text: "working" }, manager as unknown as InteractiveManager);

        expect(result).toBe(42);
        expect(manager.updates.flat().some((line) => line.includes("done"))).toBe(true);
    });

    it("should reject, fail with failText, and re-throw", async () => {
        expect.assertions(2);

        const manager = createMockManager();
        const error = new Error("boom");

        await expect(
            spinnerPromise(
                () => Promise.reject(error),
                { failText: (error_) => `failed: ${(error_ as Error).message}`, text: "working" },
                manager as unknown as InteractiveManager,
            ),
        ).rejects.toThrow("boom");

        expect(manager.updates.flat().some((line) => line.includes("failed: boom"))).toBe(true);
    });

    it("should accept a bare string as the in-progress text", async () => {
        expect.assertions(1);

        const manager = createMockManager();

        const result = await spinnerPromise(Promise.resolve("ok"), "loading", manager as unknown as InteractiveManager);

        expect(result).toBe("ok");
    });
});
