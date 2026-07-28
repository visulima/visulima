/* eslint-disable vitest/prefer-called-with */
import type { InteractiveManager } from "@visulima/interactive-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("spinner style resolution", () => {
    it("should resolve every declarative style flag via util.styleText", () => {
        expect.assertions(2);

        const spinner = new Spinner({
            name: "dots",
            style: {
                bgColor: "bgBlue",
                bold: true,
                color: "red",
                dim: true,
                italic: true,
                strikethrough: true,
                underline: true,
            },
        });

        spinner.text = "Loading";

        const output = spinner.getFrameOutput();

        // styleText wraps the frame in ANSI escape codes
        expect(output).toContain("Loading");
        expect(output.length).toBeGreaterThan("Loading".length);
    });

    it("should resolve a single color-only declarative style", () => {
        expect.assertions(1);

        const spinner = new Spinner({ name: "dots", style: { color: "green" } });

        const output = spinner.getFrameOutput();

        expect(output.length).toBeGreaterThan(0);
    });

    it("should return the identity styler for an empty style object", () => {
        expect.assertions(1);

        const spinner = new Spinner({ name: "line", style: {} });

        spinner.text = "x";

        const output = spinner.getFrameOutput();

        // No formats pushed -> frame is unchanged apart from the appended text
        expect(output).toBe("- x");
    });
});

describe("text and prefix setters while active", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should re-render via the interactive manager when text changes while active", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        manager.updates.length = 0;

        spinner.text = "Still loading";

        expect(manager.update).toHaveBeenCalled();

        spinner.succeed();
    });

    it("should re-render via the interactive manager when prefixText changes while active", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        manager.updates.length = 0;

        spinner.prefixText = "[A]";

        expect(manager.update).toHaveBeenCalled();

        spinner.succeed();
    });

    it("should re-render the whole stack when a child spinner text changes while active", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" }, manager as unknown as InteractiveManager);
        const spinner = multi.create("Task 1");

        spinner.start();
        manager.updates.length = 0;

        spinner.text = "Task 1 updated";

        expect(manager.update).toHaveBeenCalled();

        multi.stop();
    });

    it("should re-render the whole stack when a child spinner prefixText changes while active", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" }, manager as unknown as InteractiveManager);
        const spinner = multi.create("Task 1");

        spinner.start();
        manager.updates.length = 0;

        spinner.prefixText = "[child]";

        expect(manager.update).toHaveBeenCalled();

        multi.stop();
    });

    it("should update stored text when changed on an active standalone spinner with no manager", () => {
        expect.assertions(1);

        const spinner = new Spinner({ name: "dots" });

        spinner.start("Loading");
        spinner.text = "Still loading";

        expect(spinner.text).toBe("Still loading");

        spinner.succeed();
    });

    it("should update stored prefix when changed on an active standalone spinner with no manager", () => {
        expect.assertions(1);

        const spinner = new Spinner({ name: "dots" });

        spinner.start("Loading");
        spinner.prefixText = "[standalone]";

        expect(spinner.prefixText).toBe("[standalone]");

        spinner.succeed();
    });
});

describe("animation ticks", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should advance frames and re-render through the interactive manager", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        const before = manager.update.mock.calls.length;

        // dots interval is 80ms; advance through several frames
        vi.advanceTimersByTime(80 * 3);

        expect(manager.update.mock.calls.length).toBeGreaterThan(before);

        spinner.succeed();
    });

    it("should advance frames and re-render the whole stack for a multi spinner", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" }, manager as unknown as InteractiveManager);
        const spinner = multi.create("Task 1");

        spinner.start();
        const before = manager.update.mock.calls.length;

        vi.advanceTimersByTime(80 * 3);

        expect(manager.update.mock.calls.length).toBeGreaterThan(before);

        multi.stop();
    });
});

describe("pause and resume tick paths", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should be a no-op to pause when there is no running interval", () => {
        expect.assertions(1);

        const spinner = new Spinner();

        expect(() => {
            spinner.pause();
        }).not.toThrow();
    });

    it("should resume and keep ticking through the interactive manager after a pause", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        spinner.pause();
        spinner.resume();

        const before = manager.update.mock.calls.length;

        vi.advanceTimersByTime(80 * 3);

        expect(manager.update.mock.calls.length).toBeGreaterThan(before);

        spinner.succeed();
    });

    it("should clear an existing interval when resume is called without pausing first", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");

        expect(() => {
            spinner.resume();
        }).not.toThrow();

        spinner.succeed();
    });

    it("should keep ticking the whole stack after a resume for a multi spinner", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" }, manager as unknown as InteractiveManager);
        const spinner = multi.create("Task 1");

        spinner.start();
        spinner.pause();
        spinner.resume();

        const before = manager.update.mock.calls.length;

        vi.advanceTimersByTime(80 * 3);

        expect(manager.update.mock.calls.length).toBeGreaterThan(before);

        multi.stop();
    });

    it("should keep advancing frames after resume on a standalone spinner with no manager", () => {
        expect.assertions(1);

        const spinner = new Spinner({ name: "dots" });

        spinner.start("Loading");
        spinner.pause();
        spinner.resume();

        expect(() => {
            vi.advanceTimersByTime(80 * 3);
        }).not.toThrow();

        spinner.succeed();
    });
});

describe("stop icon handling", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should render without an icon when the configured icon is empty", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ icons: { success: "" }, name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        manager.updates.length = 0;

        spinner.succeed("Done");

        const lastRow = manager.updates.at(-1)?.[0];

        // No icon glyph, only the success text is emitted
        expect(lastRow).toBe(" Done");
    });

    it("should render the icon and text together when both are present", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ icons: { success: "OK" }, name: "dots" }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        manager.updates.length = 0;

        spinner.succeed("Done");

        const lastRow = manager.updates.at(-1)?.[0];

        expect(lastRow).toBe("OK Done");
    });

    it("should style the completion icon when a style is configured", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const spinner = new Spinner({ icons: { success: "OK" }, name: "dots", style: (text) => `<${text}>` }, manager as unknown as InteractiveManager);

        spinner.start("Loading");
        manager.updates.length = 0;

        spinner.succeed("Done");

        const lastRow = manager.updates.at(-1)?.[0];

        expect(lastRow).toBe("<OK> Done");
    });
});

describe("multiSpinner additional paths", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should set the interactive manager after construction", () => {
        expect.assertions(1);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" });

        multi.setInteractiveManager(manager as unknown as InteractiveManager);

        const spinner = multi.create("Task 1");

        spinner.start();

        expect(manager.hook).toHaveBeenCalled();

        multi.stop();
    });

    it("should create a spinner without initial text", () => {
        expect.assertions(1);

        const multi = new MultiSpinner({ name: "dots" });
        const spinner = multi.create();

        expect(spinner.text).toBe("");
    });

    it("should remove a spinner that is not the first entry in the stack", () => {
        expect.assertions(2);

        const multi = new MultiSpinner({ name: "dots" });

        multi.create("Task 1");
        const second = multi.create("Task 2");

        const removed = multi.remove(second);

        expect(removed).toBe(true);

        // removing the same instance again now misses
        expect(multi.remove(second)).toBe(false);
    });

    it("should stop without an interactive manager", () => {
        expect.assertions(1);

        const multi = new MultiSpinner({ name: "dots" });

        multi.create("Task 1");

        expect(() => {
            multi.stop();
        }).not.toThrow();
    });

    it("should erase and unhook when the last spinner is removed", () => {
        expect.assertions(4);

        const manager = createMockManager();
        const multi = new MultiSpinner({ name: "dots" }, manager as unknown as InteractiveManager);
        const spinner = multi.create("Task 1");

        // render once so the manager is hooked and the line is on screen
        spinner.start("Task 1");

        manager.updates.length = 0;
        manager.erase.mockClear();
        manager.unhook.mockClear();

        // removing the only spinner must clear its rendered line, not leave it behind
        multi.remove(spinner);

        expect(manager.updates).toHaveLength(0);
        expect(manager.erase).toHaveBeenCalledWith("stdout");
        expect(manager.unhook).toHaveBeenCalledWith(false);

        // a subsequent renderAll must not re-hook the emptied stack
        multi.renderAll();

        expect(manager.hook).toHaveBeenCalledTimes(1);
    });
});
