/* eslint-disable vitest/prefer-called-with */
import type { InteractiveManager } from "@visulima/interactive-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MultiSpinner, Spinner } from "../src/spinner";

describe("spinner", () => {
    describe("constructor", () => {
        it("should create a spinner with default options", () => {
            expect.assertions(4);

            const spinner = new Spinner();

            expect(spinner).toBeDefined();
            expect(spinner.isRunning).toBe(false);
            expect(spinner.text).toBe("");
            expect(spinner.prefixText).toBe("");
        });

        it("should create a spinner with custom name", () => {
            expect.assertions(1);

            const spinner = new Spinner({ name: "line" });

            expect(spinner).toBeDefined();
        });

        it("should create a spinner with custom icons", () => {
            expect.assertions(1);

            const spinner = new Spinner({
                icons: { error: "FAIL", info: "INFO", success: "OK", warning: "WARN" },
            });

            expect(spinner).toBeDefined();
        });

        it("should accept a style function", () => {
            expect.assertions(1);

            const spinner = new Spinner({
                style: (text) => `[${text}]`,
            });

            expect(spinner).toBeDefined();
        });

        it("should accept prefix text", () => {
            expect.assertions(1);

            const spinner = new Spinner({ prefixText: "[TASK]" });

            expect(spinner.prefixText).toBe("[TASK]");
        });
    });

    describe("start", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should start the spinner", () => {
            expect.assertions(2);

            const spinner = new Spinner();

            spinner.start("Loading...");

            expect(spinner.isRunning).toBe(true);
            expect(spinner.text).toBe("Loading...");

            spinner.succeed();
        });

        it("should not start if verbose is false", () => {
            expect.assertions(1);

            const spinner = new Spinner({ verbose: false });

            spinner.start("Loading...");

            expect(spinner.isRunning).toBe(false);
        });

        it("should not start twice", () => {
            expect.assertions(2);

            const spinner = new Spinner();

            const result1 = spinner.start("First");
            const result2 = spinner.start("Second");

            expect(result1).toBe(result2);
            expect(spinner.text).toBe("First");

            spinner.succeed();
        });

        it("should accept start options with prefixText", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.start("Loading...", { prefixText: "[INFO]" });

            expect(spinner.prefixText).toBe("[INFO]");

            spinner.succeed();
        });
    });

    describe("stop methods", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("succeed should stop the spinner", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.start("Loading...");
            spinner.succeed("Done!");

            expect(spinner.isRunning).toBe(false);
        });

        it("failed should stop the spinner", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.start("Loading...");
            spinner.failed("Error!");

            expect(spinner.isRunning).toBe(false);
        });

        it("warn should stop the spinner", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.start("Loading...");
            spinner.warn("Warning!");

            expect(spinner.isRunning).toBe(false);
        });

        it("info should stop the spinner", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.start("Loading...");
            spinner.info("Information");

            expect(spinner.isRunning).toBe(false);
        });

        it("should not stop if not active", () => {
            expect.assertions(4);

            const spinner = new Spinner();

            expect(() => {
                spinner.succeed("Done!");
            }).not.toThrow();
            expect(() => {
                spinner.failed("Error!");
            }).not.toThrow();
            expect(() => {
                spinner.warn("Warning!");
            }).not.toThrow();
            expect(() => {
                spinner.info("Info!");
            }).not.toThrow();
        });
    });

    describe("text and prefixText", () => {
        it("should set text via setter", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.text = "New text";

            expect(spinner.text).toBe("New text");
        });

        it("should set prefixText via setter", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.prefixText = "[PREFIX]";

            expect(spinner.prefixText).toBe("[PREFIX]");
        });
    });

    describe("pause and resume", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should pause the spinner", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.start("Loading...");
            spinner.pause();

            expect(spinner.isRunning).toBe(true);

            spinner.succeed();
        });

        it("should resume after pause", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.start("Loading...");
            spinner.pause();
            spinner.resume();

            expect(spinner.isRunning).toBe(true);

            spinner.succeed();
        });

        it("should not resume if not active", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            spinner.resume();

            expect(spinner.isRunning).toBe(false);
        });
    });

    describe("elapsedTime", () => {
        it("should return 0 before the spinner is started", () => {
            expect.assertions(1);

            const spinner = new Spinner();

            expect(spinner.elapsedTime).toBe(0);
        });

        it("should return 0 for a verbose:false spinner that never sets a start time", () => {
            expect.assertions(1);

            const spinner = new Spinner({ verbose: false });

            spinner.start("Loading...");

            expect(spinner.elapsedTime).toBe(0);
        });

        it("should track elapsed time", () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const spinner = new Spinner();

            spinner.start("Loading...");
            vi.advanceTimersByTime(1000);

            expect(spinner.elapsedTime).toBeGreaterThanOrEqual(1000);

            spinner.succeed();
            vi.useRealTimers();
        });
    });

    describe("getFrameOutput", () => {
        it("should return frame output with text", () => {
            expect.assertions(1);

            const spinner = new Spinner({ name: "dots" });

            spinner.text = "Loading";

            const output = spinner.getFrameOutput();

            expect(output).toContain("Loading");
        });

        it("should include prefix text", () => {
            expect.assertions(2);

            const spinner = new Spinner({ name: "dots", prefixText: "[INFO]" });

            spinner.text = "Loading";

            const output = spinner.getFrameOutput();

            expect(output).toContain("[INFO]");
            expect(output).toContain("Loading");
        });

        it("should apply style function", () => {
            expect.assertions(2);

            const spinner = new Spinner({
                name: "dots",
                style: (text) => `<${text}>`,
            });

            const output = spinner.getFrameOutput();

            expect(output).toContain("<");
            expect(output).toContain(">");
        });
    });

    describe("interactive manager integration", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should work with an interactive manager", () => {
            expect.assertions(4);

            const updates: string[][] = [];
            const mockManager = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                hook: vi.fn().mockReturnValue(true),
                // eslint-disable-next-line vitest/require-mock-type-parameters
                unhook: vi.fn().mockReturnValue(true),
                // eslint-disable-next-line vitest/require-mock-type-parameters
                update: vi.fn((_, rows: string[]) => {
                    updates.push(rows);
                }),
            };

            const spinner = new Spinner({ name: "dots" }, mockManager as unknown as InteractiveManager);

            spinner.start("Loading...");

            expect(mockManager.hook).toHaveBeenCalled();
            expect(mockManager.update).toHaveBeenCalled();
            expect(updates.length).toBeGreaterThan(0);

            spinner.succeed("Done!");

            expect(mockManager.unhook).toHaveBeenCalled();
        });

        it("should setInteractiveManager after construction", () => {
            expect.assertions(1);

            const mockManager = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                hook: vi.fn().mockReturnValue(true),
                // eslint-disable-next-line vitest/require-mock-type-parameters
                unhook: vi.fn().mockReturnValue(true),
                // eslint-disable-next-line vitest/require-mock-type-parameters
                update: vi.fn(),
            };

            const spinner = new Spinner({ name: "dots" });

            spinner.setInteractiveManager(mockManager as unknown as InteractiveManager);
            spinner.start("Loading...");

            expect(mockManager.hook).toHaveBeenCalled();

            spinner.succeed();
        });
    });
});

describe("multiSpinner", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should create spinners", () => {
        expect.assertions(2);

        const multi = new MultiSpinner({ name: "dots" });
        const spinner = multi.create("Task 1");

        expect(spinner).toBeInstanceOf(Spinner);
        expect(spinner.text).toBe("Task 1");
    });

    it("should remove spinners", () => {
        expect.assertions(1);

        const multi = new MultiSpinner({ name: "dots" });
        const spinner = multi.create("Task 1");

        const removed = multi.remove(spinner);

        expect(removed).toBe(true);
    });

    it("should return false when removing unknown spinner", () => {
        expect.assertions(1);

        const multi = new MultiSpinner({ name: "dots" });
        const foreignSpinner = new Spinner({ name: "dots" });

        const removed = multi.remove(foreignSpinner);

        expect(removed).toBe(false);
    });

    it("should work with interactive manager", () => {
        expect.assertions(3);

        const mockManager = {
            // eslint-disable-next-line vitest/require-mock-type-parameters
            hook: vi.fn().mockReturnValue(true),
            // eslint-disable-next-line vitest/require-mock-type-parameters
            unhook: vi.fn().mockReturnValue(true),
            // eslint-disable-next-line vitest/require-mock-type-parameters
            update: vi.fn(),
        };

        const multi = new MultiSpinner({ name: "dots" }, mockManager as unknown as InteractiveManager);
        const spinner1 = multi.create("Task 1");
        const spinner2 = multi.create("Task 2");

        spinner1.start();
        spinner2.start();

        expect(mockManager.hook).toHaveBeenCalled();
        expect(mockManager.update).toHaveBeenCalled();

        multi.stop();

        expect(mockManager.unhook).toHaveBeenCalled();
    });

    it("should clear all spinners", () => {
        expect.assertions(1);

        const multi = new MultiSpinner({ name: "dots" });

        multi.create("Task 1");
        multi.create("Task 2");

        multi.clear();

        const spinner3 = multi.create("Task 3");

        expect(spinner3).toBeInstanceOf(Spinner);
    });
});
