import { stderr, stdout } from "node:process";

import { beforeEach, describe, expect, it, vi } from "vitest";

import InteractiveManager from "../../src/interactive/interactive-manager";
import { PailServer } from "../../src/pail.server";
import RawReporter from "../../src/reporter/raw/raw-reporter.server";

describe("pailServerImpl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it("should log messages correctly using different log levels", () => {
        expect.assertions(3);

        const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
        const logStdoutSpy = vi.spyOn(stdout, "write");
        const logStderrSpy = vi.spyOn(stderr, "write");

        pailServer.info("Info message");
        pailServer.warn("Warning message");
        pailServer.error("Error message");

        expect(logStdoutSpy).toHaveBeenNthCalledWith(1, "Info message");
        expect(logStdoutSpy).toHaveBeenNthCalledWith(2, "Warning message");
        expect(logStderrSpy).toHaveBeenCalledExactlyOnceWith("Error message");
    });

    it("should handle interactive mode correctly", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ interactive: true, stderr, stdout });

        expect(pailServer.getInteractiveManager()).toBeInstanceOf(InteractiveManager);
    });

    it("should wrap and restore console methods", () => {
        expect.assertions(2);

        const pailServer = new PailServer({ stderr, stdout });

        // eslint-disable-next-line no-console
        const originalConsoleLog = console.log;

        pailServer.wrapConsole();

        // eslint-disable-next-line no-console
        expect(console.log).not.toBe(originalConsoleLog);

        pailServer.restoreConsole();

        // eslint-disable-next-line no-console
        expect(console.log).toBe(originalConsoleLog);
    });

    it("should avoid infinite loop when wrapping console", () => {
        expect.assertions(2);

        const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
        const logStdoutSpy = vi.spyOn(stdout, "write");

        pailServer.wrapConsole();

        const object = {
            get value() {
                // eslint-disable-next-line no-console
                console.warn(object);

                return "anything";
            },
        };

        // This should complete without hanging (no infinite loop)
        pailServer.warn(object);
        pailServer.restoreConsole();

        // Should have at least one log call (the original warn call)
        expect(logStdoutSpy.mock.calls.length).toBeGreaterThan(0);
        // Should not have hundreds of calls (which would indicate infinite looping)
        expect(logStdoutSpy.mock.calls.length).toBeLessThan(100);
    });

    it("should wrap and restore stdout and stderr streams", () => {
        expect.assertions(4);

        const pailServer = new PailServer({ stderr, stdout });

        const originalStdoutWrite = stdout.write;

        const originalStderrWrite = stderr.write;

        pailServer.wrapStd();

        expect(stdout.write).not.toBe(originalStdoutWrite);

        expect(stderr.write).not.toBe(originalStderrWrite);

        pailServer.restoreStd();

        expect(stdout.write).toBe(originalStdoutWrite);

        expect(stderr.write).toBe(originalStderrWrite);
    });

    it("should handle logging when disabled", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ disabled: true, stderr, stdout });
        const logSpy = vi.spyOn(pailServer, "log");

        pailServer.info("This should not be logged");

        expect(logSpy).not.toHaveBeenCalled();
    });

    it("should handle missing or invalid stream objects", () => {
        expect.assertions(2);

        const pailServer = new PailServer({ stderr: null as unknown as NodeJS.WriteStream, stdout: null as unknown as NodeJS.WriteStream });

        expect(() => pailServer.wrapStd()).not.toThrow();
        expect(() => pailServer.restoreStd()).not.toThrow();
    });

    it("should handle empty or invalid scope names", () => {
        expect.assertions(2);

        const pailServer = new PailServer({ stderr, stdout });

        expect(() => pailServer.scope()).toThrow("No scope name was defined.");
        expect(() => pailServer.scope("validScope")).not.toThrow();
    });

    it("should handle logging with circular references in objects", () => {
        expect.assertions(1);

        const circularObject = {} as any;

        circularObject.self = circularObject;

        const pailServer = new PailServer({ stderr, stdout });

        expect(() => pailServer.log(circularObject)).not.toThrow();
    });

    it("should group messages correctly", () => {
        expect.assertions(7);

        const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
        const logStdoutSpy = vi.spyOn(stdout, "write");

        const newLogger3 = pailServer.scope("group");

        newLogger3.log("This is the outer level");
        newLogger3.group();
        newLogger3.log("Level 2");
        newLogger3.info("Hello world!");
        newLogger3.group();
        newLogger3.log("Level 3");
        newLogger3.warn("More of level 3");
        newLogger3.groupEnd();
        newLogger3.log("Back to level 2");
        newLogger3.groupEnd();
        newLogger3.log("Back to the outer level");

        expect(logStdoutSpy).toHaveBeenNthCalledWith(1, "This is the outer level");
        expect(logStdoutSpy).toHaveBeenNthCalledWith(2, "    Level 2");
        expect(logStdoutSpy).toHaveBeenNthCalledWith(3, "    Hello world!");
        expect(logStdoutSpy).toHaveBeenNthCalledWith(4, "        Level 3");
        expect(logStdoutSpy).toHaveBeenNthCalledWith(5, "        More of level 3");
        expect(logStdoutSpy).toHaveBeenNthCalledWith(6, "    Back to level 2");
        expect(logStdoutSpy).toHaveBeenNthCalledWith(7, "Back to the outer level");
    });

    describe("pause and resume", () => {
        it("should queue messages when paused and flush them on resume", () => {
            expect.assertions(3);

            const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
            const logStdoutSpy = vi.spyOn(stdout, "write");

            // Pause the logger
            pailServer.pause();

            // These messages should be queued
            pailServer.info("Message 1");
            pailServer.warn("Message 2");
            pailServer.debug("Message 3");

            // No messages should have been logged yet
            expect(logStdoutSpy).not.toHaveBeenCalled();

            // Resume the logger
            pailServer.resume();

            // All three messages should now be logged in order
            expect(logStdoutSpy).toHaveBeenCalledTimes(3);
            expect(logStdoutSpy).toHaveBeenNthCalledWith(1, "Message 1");
        });

        it("should not queue messages when not paused", () => {
            expect.assertions(2);

            const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
            const logStdoutSpy = vi.spyOn(stdout, "write");

            // Log without pausing
            pailServer.info("Immediate message");

            // Message should be logged immediately
            expect(logStdoutSpy).toHaveBeenCalledTimes(1);
            expect(logStdoutSpy).toHaveBeenCalledWith("Immediate message");
        });

        it("should handle multiple pause/resume cycles", () => {
            expect.assertions(3);

            const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
            const logStdoutSpy = vi.spyOn(stdout, "write");

            // First cycle
            pailServer.pause();
            pailServer.info("Queued 1");
            pailServer.resume();

            expect(logStdoutSpy).toHaveBeenCalledTimes(1);

            // Second cycle
            pailServer.pause();
            pailServer.info("Queued 2");
            pailServer.info("Queued 3");
            pailServer.resume();

            expect(logStdoutSpy).toHaveBeenCalledTimes(3);

            // Third cycle - immediate log
            pailServer.info("Immediate");

            expect(logStdoutSpy).toHaveBeenCalledTimes(4);
        });

        it("should preserve message order when flushing queue", () => {
            expect.assertions(4);

            const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
            const logStdoutSpy = vi.spyOn(stdout, "write");

            pailServer.pause();
            pailServer.info("First");
            pailServer.warn("Second");
            pailServer.debug("Third");
            pailServer.resume();

            expect(logStdoutSpy).toHaveBeenCalledTimes(3);
            expect(logStdoutSpy).toHaveBeenNthCalledWith(1, "First");
            expect(logStdoutSpy).toHaveBeenNthCalledWith(2, "Second");
            expect(logStdoutSpy).toHaveBeenNthCalledWith(3, "Third");
        });

        it("should not output messages when disabled even if queued", () => {
            expect.assertions(1);

            const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
            const logStdoutSpy = vi.spyOn(stdout, "write");

            pailServer.pause();
            pailServer.info("Queued message");
            pailServer.disable();
            pailServer.resume();

            // Message should not be logged because logger is disabled
            expect(logStdoutSpy).not.toHaveBeenCalled();
        });
    });
});

describe("interactive mode validation", () => {
    it("should throw when creating spinner without interactive mode", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ interactive: false, stderr, stdout });

        expect(() => pailServer.createSpinner()).toThrow("Interactive mode is not enabled");
    });

    it("should throw when creating progress bar without interactive mode", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ interactive: false, stderr, stdout });

        expect(() => pailServer.createProgressBar({ total: 100 })).toThrow("Interactive mode is not enabled");
    });

    it("should throw when creating multi-spinner without interactive mode", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ interactive: false, stderr, stdout });

        expect(() => pailServer.createMultiSpinner()).toThrow("Interactive mode is not enabled");
    });

    it("should throw when creating multi-progress-bar without interactive mode", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ interactive: false, stderr, stdout });

        expect(() => pailServer.createMultiProgressBar()).toThrow("Interactive mode is not enabled");
    });

    it("should accept empty options for spinner (parity with progress bar)", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ interactive: true, stderr, stdout });
        const spinner = pailServer.createSpinner(); // no options

        expect(spinner).toBeDefined();
    });

    it("should accept empty options for multi-spinner", () => {
        expect.assertions(1);

        const pailServer = new PailServer({ interactive: true, stderr, stdout });
        const multiSpinner = pailServer.createMultiSpinner(); // no options

        expect(multiSpinner).toBeDefined();
    });
});
