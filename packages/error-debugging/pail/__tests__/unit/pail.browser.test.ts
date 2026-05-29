import { beforeEach, describe, expect, it, vi } from "vitest";

import { PailBrowser } from "../../src/pail.browser";
import RawReporter from "../../src/reporter/raw/raw-reporter.browser";

/* eslint-disable sonarjs/slow-regex */
const MS_REGEX = /(.*) ms/;
const TIMER_RUN_REGEX = /Timer run for: (.*)ms/;
/* eslint-enable sonarjs/slow-regex */

describe("pailBrowserImpl", () => {
    it("should log different types of messages correctly", () => {
        expect.assertions(2);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
            types: {
                customType: {
                    badge: "CUSTOM",
                    color: "green",
                    label: "custom",
                    logLevel: "debug",
                },
            },
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.info("Info message");
        logger.customType("Custom log message", { key: "value" });

        expect(consoleSpy).toHaveBeenCalledWith("Info message");
        expect(consoleSpy).toHaveBeenCalledWith("Custom log message", { key: "value" });

        consoleSpy.mockRestore();
    });

    it("should not log messages when disabled", () => {
        expect.assertions(1);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.disable();
        logger.info("This should not be logged");

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it("should wrap and restore console methods correctly", () => {
        expect.assertions(2);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        // eslint-disable-next-line no-console
        const originalConsoleLog = console.log;

        logger.wrapConsole();

        // eslint-disable-next-line no-console
        expect(console.log).not.toBe(originalConsoleLog);

        logger.restoreConsole();

        // eslint-disable-next-line no-console
        expect(console.log).toBe(originalConsoleLog);
    });

    it("should keep the first console backup when wrapConsole runs twice", () => {
        expect.assertions(1);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        // eslint-disable-next-line no-console
        const originalConsoleLog = console.log;

        logger.wrapConsole();
        // Second wrap must not overwrite the backup with the already-installed wrapper.
        logger.wrapConsole();
        logger.restoreConsole();

        // eslint-disable-next-line no-console
        expect(console.log).toBe(originalConsoleLog);
    });

    it("should no-op wrapException when process is undefined", () => {
        expect.assertions(1);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        vi.stubGlobal("process", undefined);

        expect(() => {
            logger.wrapException();
        }).not.toThrow();

        vi.unstubAllGlobals();
    });

    it("should start, log, and end timers correctly", () => {
        expect.assertions(3);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.time("testTimer");
        logger.timeLog("testTimer", "Intermediate log");
        logger.timeEnd("testTimer");

        expect(consoleSpy).toHaveBeenCalledWith("Initialized timer...");
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(MS_REGEX), "Intermediate log");
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(TIMER_RUN_REGEX));

        consoleSpy.mockRestore();
    });

    it.skipIf(globalThis.window === undefined)("should group and ungroup logs correctly", () => {
        expect.assertions(2);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleGroupSpy = vi.spyOn(console, "group").mockImplementation(() => {});
        const consoleGroupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => {});

        logger.group("Test Group");

        expect(consoleGroupSpy).toHaveBeenCalledExactlyOnceWith("Test Group");

        logger.groupEnd();

        expect(consoleGroupEndSpy).toHaveBeenCalledExactlyOnceWith();

        consoleGroupSpy.mockRestore();
        consoleGroupEndSpy.mockRestore();
    });

    it("should not log messages when logger is disabled", () => {
        expect.assertions(1);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.disable();
        logger.info("This should not be logged");

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it("should handle undefined or null message correctly", () => {
        expect.assertions(2);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.info(undefined);
        logger.info(null);

        expect(consoleSpy).toHaveBeenCalledWith(undefined);
        expect(consoleSpy).toHaveBeenCalledWith(null);

        consoleSpy.mockRestore();
    });

    it("should warn when starting a timer with an existing label", () => {
        expect.assertions(1);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.time("testTimer");
        logger.time("testTimer");

        expect(consoleSpy).toHaveBeenCalledWith("Timer 'testTimer' already exists");

        consoleSpy.mockRestore();
    });

    it("should warn when ending a timer that does not exist", () => {
        expect.assertions(1);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.timeEnd("nonExistentTimer");

        expect(consoleSpy).toHaveBeenCalledExactlyOnceWith("Timer not found");

        consoleSpy.mockRestore();
    });

    it("should count with an undefined label correctly", () => {
        expect.assertions(1);

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.count();

        expect(consoleSpy).toHaveBeenCalledExactlyOnceWith("default: 1");

        consoleSpy.mockRestore();
    });

    it("should be possible to enable and disable pail", () => {
        expect.assertions(2);

        const logger = new PailBrowser({});

        expect(logger.isEnabled()).toBe(true);

        logger.disable();

        expect(logger.isEnabled()).toBe(false);
    });

    describe("argument handling", () => {
        let logger: PailBrowser;
        let rawReporter: RawReporter;

        beforeEach(() => {
            rawReporter = new RawReporter();
            logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter,
                reporters: [rawReporter],
                scope: ["test"],
                throttle: 1000,
                throttleMin: 5,
            });
        });

        it("should handle multiple arguments correctly", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            logger.info({ context: { test: "test1" } }, "Hello World", { context: { test: "test2" } });

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                context: ["Hello World", { context: { test: "test2" } }],
                message: { context: { test: "test1" } },
                type: { level: "informational", name: "info" },
            });
        });

        it("should handle structured Message objects correctly", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            logger.info({
                context: { user: "alice" },
                message: "Structured message",
                prefix: "User Action",
            });

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                context: { user: "alice" },
                message: "Structured message",
                prefix: "User Action",
                type: { level: "informational", name: "info" },
            });
        });

        it("should handle Message objects with additional arguments", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            logger.info(
                {
                    context: { user: "alice" },
                    message: "Structured message",
                    prefix: "User Action",
                },
                "Additional info",
                { extra: "data" },
            );

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                context: [{ user: "alice" }, "Additional info", { extra: "data" }],
                message: "Structured message",
                prefix: "User Action",
                type: { level: "informational", name: "info" },
            });
        });

        it("should handle Error objects correctly", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            const testError = new Error("Test error");

            logger.error(testError);

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                error: testError,
                type: { level: "error", name: "error" },
            });
        });

        it("should handle Error objects with additional context", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            const testError = new Error("Test error");

            logger.error(testError, "Additional context", { code: 500 });

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                context: ["Additional context", { code: 500 }],
                error: testError,
                type: { level: "error", name: "error" },
            });
        });

        it("should handle single object arguments", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            logger.info({ key: "value" });

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                message: { key: "value" },
                type: { level: "informational", name: "info" },
            });
        });

        it("should handle single primitive arguments", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            logger.info("Simple message");

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                message: "Simple message",
                type: { level: "informational", name: "info" },
            });
        });

        it("should handle empty arguments gracefully", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            // @ts-expect-error - testing edge case
            logger.info();

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                type: { level: "informational", name: "info" },
            });
        });

        it("should avoid infinite loop when wrapping console", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            logger.wrapConsole();

            const object = {
                get value() {
                    // eslint-disable-next-line no-console
                    console.warn(object);

                    return "anything";
                },
            };

            // This should complete without hanging (no infinite loop)
            logger.warn(object);
            logger.restoreConsole();

            // Should have at least one log (the original warn call)
            expect(loggedMeta.length).toBeGreaterThan(0);
            // Should not have hundreds of logs (which would indicate infinite looping)
            expect(loggedMeta.length).toBeLessThan(100);
        });
    });

    describe("pause and resume", () => {
        it("should queue messages when paused and flush them on resume", () => {
            expect.assertions(3);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // Pause the logger
            logger.pause();

            // These messages should be queued
            logger.info("Message 1");
            logger.warn("Message 2");
            logger.debug("Message 3");

            // No messages should have been logged yet
            expect(consoleSpy).not.toHaveBeenCalled();

            // Resume the logger
            logger.resume();

            // All three messages should now be logged in order
            expect(consoleSpy).toHaveBeenCalledTimes(3);
            expect(consoleSpy).toHaveBeenCalledWith("Message 1");

            consoleSpy.mockRestore();
        });

        it("should not queue messages when not paused", () => {
            expect.assertions(2);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // Log without pausing
            logger.info("Immediate message");

            // Message should be logged immediately
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith("Immediate message");

            consoleSpy.mockRestore();
        });

        it("should handle multiple pause/resume cycles", () => {
            expect.assertions(3);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // First cycle
            logger.pause();
            logger.info("Queued 1");
            logger.resume();

            expect(consoleSpy).toHaveBeenCalledTimes(1);

            // Second cycle
            logger.pause();
            logger.info("Queued 2");
            logger.info("Queued 3");
            logger.resume();

            expect(consoleSpy).toHaveBeenCalledTimes(3);

            // Third cycle - immediate log
            logger.info("Immediate");

            expect(consoleSpy).toHaveBeenCalledTimes(4);

            consoleSpy.mockRestore();
        });

        it("should preserve message order when flushing queue", () => {
            expect.assertions(4);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.pause();
            logger.info("First");
            logger.warn("Second");
            logger.debug("Third");
            logger.resume();

            expect(consoleSpy).toHaveBeenCalledTimes(3);
            expect(consoleSpy).toHaveBeenCalledWith("First");
            expect(consoleSpy).toHaveBeenCalledWith("Second");
            expect(consoleSpy).toHaveBeenCalledWith("Third");

            consoleSpy.mockRestore();
        });

        it("should not output messages when disabled even if queued", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.pause();
            logger.info("Queued message");
            logger.disable();
            logger.resume();

            // Message should not be logged because logger is disabled
            expect(consoleSpy).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe("force", () => {
        it("should bypass log level filter when using force methods", () => {
            expect.assertions(2);

            const logger = new PailBrowser({
                logLevel: "warning", // Set to warning, so info/debug should be filtered
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // Normal info should not be logged (level is warn)
            logger.info("This should not be logged");

            expect(consoleSpy).not.toHaveBeenCalled();

            // Force info should be logged despite level being warn
            logger.force.info("This will show even if level is set to 'warn'");

            expect(consoleSpy).toHaveBeenCalledWith("This will show even if level is set to 'warn'");

            consoleSpy.mockRestore();
        });

        it("should bypass log level filter for all log types", () => {
            expect.assertions(6);

            const logger = new PailBrowser({
                logLevel: "warning",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const consoleTraceSpy = vi.spyOn(console, "trace").mockImplementation(() => {});

            // Force methods should work for different log types
            logger.force.error("Something went wrong!");
            logger.force.debug("Debug message");
            logger.force.trace("Trace message");

            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleTraceSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith("Something went wrong!");
            expect(consoleLogSpy).toHaveBeenCalledWith("Debug message");
            expect(consoleTraceSpy).toHaveBeenCalledWith("Trace message");

            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
            consoleTraceSpy.mockRestore();
        });
    });

    describe("child", () => {
        it("should create child logger that inherits parent settings", () => {
            expect.assertions(3);

            const parent = new PailBrowser({
                logLevel: "informational",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
                types: {
                    http: {
                        label: "HTTP",
                        logLevel: "informational",
                    },
                },
            });

            const child = parent.child();

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // Child should inherit parent types
            child.http("GET /api 200");

            expect(consoleSpy).toHaveBeenCalledWith("GET /api 200");

            // Child should inherit parent log level
            child.debug("Debug message"); // Should not be logged (level is info)

            expect(consoleSpy).toHaveBeenCalledTimes(1);

            // Child should have its own state
            child.time("test");
            child.timeEnd("test");

            expect(consoleSpy).toHaveBeenCalledTimes(3); // http + timer start + timer end

            consoleSpy.mockRestore();
        });

        it("should allow overriding parent settings in child", () => {
            expect.assertions(2);

            const parent = new PailBrowser({
                logLevel: "warning",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child({ logLevel: "debug" });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // Parent should use warning level
            parent.info("Parent info"); // Should not be logged

            expect(consoleSpy).not.toHaveBeenCalled();

            // Child should use debug level
            child.info("Child info"); // Should be logged

            expect(consoleSpy).toHaveBeenCalledWith("Child info");

            consoleSpy.mockRestore();
        });

        it("should merge parent and child types", () => {
            expect.assertions(2);

            const parent = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
                types: {
                    http: {
                        label: "HTTP",
                        logLevel: "info",
                    },
                },
            });

            const child = parent.child({
                types: {
                    db: {
                        label: "DB",
                        logLevel: "info",
                    },
                },
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // Child should have parent types
            child.http("GET /api 200");

            expect(consoleSpy).toHaveBeenCalledWith("GET /api 200");

            // Child should have new types
            child.db("Query executed");

            expect(consoleSpy).toHaveBeenCalledWith("Query executed");

            consoleSpy.mockRestore();
        });

        it("should merge parent and child scope", () => {
            expect.assertions(1);

            const parent = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                scope: ["parent"],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child({ scope: ["child"] });

            // Child scope should extend parent scope
            expect(child.scopeName).toStrictEqual(["parent", "child"]);
        });

        it("should use the child scope when the parent has none", () => {
            expect.assertions(1);

            const parent = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child({ scope: ["only-child"] });

            expect(child.scopeName).toStrictEqual(["only-child"]);
        });

        it("should inherit the parent scope when the child provides none", () => {
            expect.assertions(1);

            const parent = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                scope: ["only-parent"],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child();

            expect(child.scopeName).toStrictEqual(["only-parent"]);
        });

        it("should combine parent and child reporters", () => {
            expect.assertions(2);

            const parentReporter = new RawReporter();
            const childReporter = new RawReporter();

            const parent = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [parentReporter],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child({ reporters: [childReporter] });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            child.info("Test message");

            // Should be called twice (once for each reporter)
            expect(consoleSpy).toHaveBeenCalledTimes(2);
            expect(consoleSpy).toHaveBeenCalledWith("Test message");

            consoleSpy.mockRestore();
        });

        it("should combine parent and child processors", () => {
            expect.assertions(1);

            const parentProcess = vi.fn((meta) => meta);
            const childProcess = vi.fn((meta) => meta);

            const parent = new PailBrowser({
                logLevel: "debug",
                processors: [{ process: parentProcess }],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child({ processors: [{ process: childProcess }] });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            child.info("processed by both");

            expect(parentProcess.mock.calls.length + childProcess.mock.calls.length).toBeGreaterThanOrEqual(2);

            consoleSpy.mockRestore();
        });

        it("should merge parent and child log levels", () => {
            expect.assertions(1);

            const parent = new PailBrowser({
                logLevel: "debug",
                logLevels: { custom: 100 },
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child({ logLevels: { extra: 200 } });

            const { logLevels } = child as unknown as { logLevels: Record<string, number> };

            expect(logLevels).toMatchObject({ custom: 100, extra: 200 });
        });

        it("should override timer messages provided to the child", () => {
            expect.assertions(1);

            const parent = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const child = parent.child({ messages: { timerStart: "Child timer started" } });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            child.time("task");

            expect(consoleSpy).toHaveBeenCalledWith("Child timer started");

            consoleSpy.mockRestore();
        });
    });

    describe("scope", () => {
        it("should set the scope name via scope()", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.scope("auth", "login");

            expect(logger.scopeName).toStrictEqual(["auth", "login"]);
        });

        it("should throw when scope() is called without a name", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            expect(() => logger.scope()).toThrow("No scope name was defined.");
        });

        it("should clear the scope via unscope()", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                scope: ["initial"],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.unscope();

            expect(logger.scopeName).toStrictEqual([]);
        });
    });

    describe("enable", () => {
        it("should re-enable logging after disable via enable()", () => {
            expect.assertions(2);

            const logger = new PailBrowser({});

            logger.disable();

            expect(logger.isEnabled()).toBe(false);

            logger.enable();

            expect(logger.isEnabled()).toBe(true);
        });
    });

    describe("wrapException", () => {
        it("should register uncaughtException and unhandledRejection handlers that forward to error()", () => {
            expect.assertions(3);

            const handlers: Record<string, (error: unknown) => void> = {};
            const onSpy = vi.spyOn(process, "on").mockImplementation((event: string, handler: (...arguments_: any[]) => void) => {
                handlers[event] = handler;

                return process;
            });
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.wrapException();

            handlers.uncaughtException(new Error("uncaught"));
            handlers.unhandledRejection(new Error("rejected"));

            expect(onSpy).toHaveBeenCalledWith("uncaughtException", expect.any(Function));
            expect(onSpy).toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
            expect(errorSpy).toHaveBeenCalledTimes(2);

            onSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });

    describe("groups", () => {
        it("should track groups internally when no window is present", () => {
            expect.assertions(2);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const { groups } = logger as unknown as { groups: string[] };

            logger.group("Section");

            expect(groups).toContain("Section");

            logger.groupEnd();

            expect(groups).not.toContain("Section");
        });

        it("should call console.group and console.groupEnd when a window is present", () => {
            expect.assertions(2);

            vi.stubGlobal("window", {});

            const groupSpy = vi.spyOn(console, "group").mockImplementation(() => {});
            const groupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => {});

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.group("DOM Section");
            logger.groupEnd();

            expect(groupSpy).toHaveBeenCalledWith("DOM Section");
            expect(groupEndSpy).toHaveBeenCalledTimes(1);

            groupSpy.mockRestore();
            groupEndSpy.mockRestore();
            vi.unstubAllGlobals();
        });
    });

    describe("countReset", () => {
        it("should reset an existing counter", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.count("hits");
            logger.countReset("hits");
            logger.count("hits");

            expect(consoleSpy).toHaveBeenCalledWith("hits: 1");

            consoleSpy.mockRestore();
        });

        it("should warn when resetting a counter that does not exist", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.countReset("missing");

            expect(consoleSpy).toHaveBeenCalledWith("Count for missing does not exist");

            consoleSpy.mockRestore();
        });
    });

    describe("clear", () => {
        it("should clear the console", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const clearSpy = vi.spyOn(console, "clear").mockImplementation(() => {});

            logger.clear();

            expect(clearSpy).toHaveBeenCalledTimes(1);

            clearSpy.mockRestore();
        });
    });

    describe("raw", () => {
        it("should send raw messages directly to the raw reporter", () => {
            expect.assertions(2);

            const loggedMeta: any[] = [];
            const rawReporter = new RawReporter();

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter,
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.raw("direct", { data: "value" });

            expect(loggedMeta).toHaveLength(1);
            expect(loggedMeta[0]).toMatchObject({
                context: [{ data: "value" }],
                message: "direct",
            });
        });

        it("should not emit raw messages when disabled", () => {
            expect.assertions(1);

            const loggedMeta: any[] = [];
            const rawReporter = new RawReporter();

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter,
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.disable();
            logger.raw("ignored");

            expect(loggedMeta).toHaveLength(0);
        });
    });

    describe("timer label fallbacks", () => {
        it("should use the most recent timer when timeLog is called without a label", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.time("only");
            logger.timeLog();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(MS_REGEX));

            consoleSpy.mockRestore();
        });

        it("should warn when timeLog references a missing timer", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.timeLog("missing");

            expect(consoleSpy).toHaveBeenCalledWith("Timer not found");

            consoleSpy.mockRestore();
        });

        it("should use the most recent timer when timeEnd is called without a label", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.time("solo");
            logger.timeEnd();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(TIMER_RUN_REGEX));

            consoleSpy.mockRestore();
        });

        it("should format elapsed durations of a second or more in seconds", () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.time("slow");
            vi.advanceTimersByTime(1500);
            logger.timeLog("slow");
            logger.timeEnd("slow");

            expect(consoleSpy).toHaveBeenCalledWith("1.50 s");
            expect(consoleSpy).toHaveBeenCalledWith("Timer run for: 1.50 s");

            consoleSpy.mockRestore();
            vi.useRealTimers();
        });
    });

    describe("reporters and processors", () => {
        it("should call setLoggerTypes and setStringify on reporters that support them", () => {
            expect.assertions(3);

            const log = vi.fn();
            const setLoggerTypes = vi.fn();
            const setStringify = vi.fn();

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [{ log, setLoggerTypes, setStringify } as never],
                throttle: 1000,
                throttleMin: 5,
            });

            expect(setLoggerTypes).toHaveBeenCalledTimes(1);
            expect(setStringify).toHaveBeenCalledTimes(1);

            logger.info("via custom reporter");

            expect(log).toHaveBeenCalledTimes(1);
        });

        it("should run registered processors over the meta and configure setStringify", () => {
            expect.assertions(2);

            const process = vi.fn((meta) => meta);
            const setStringify = vi.fn();

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [{ process, setStringify } as never],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.info("processed");

            expect(setStringify).toHaveBeenCalledTimes(1);
            expect(process).toHaveBeenCalledTimes(1);

            consoleSpy.mockRestore();
        });

        it("should ignore re-entrant log calls while already logging", () => {
            expect.assertions(1);

            let nested = false;
            let logger: PailBrowser;

            // eslint-disable-next-line prefer-const
            logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [
                    {
                        log: () => {
                            if (!nested) {
                                nested = true;
                                logger.warn("re-entrant");
                            }
                        },
                    },
                ],
                throttle: 1000,
                throttleMin: 5,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            logger.info("outer");

            expect(nested).toBe(true);

            consoleSpy.mockRestore();
        });

        it("should reset the loop guard and rethrow when a reporter throws", () => {
            expect.assertions(1);

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [
                    {
                        log: () => {
                            throw new Error("boom");
                        },
                    },
                ],
                throttle: 1000,
                throttleMin: 5,
            });

            expect(() => {
                logger.info("explode");
            }).toThrow("boom");
        });
    });

    describe("buildMeta", () => {
        it("should set the suffix from a Message object", () => {
            expect.assertions(1);

            const loggedMeta: any[] = [];
            const rawReporter = new RawReporter();

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter,
                reporters: [rawReporter],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.info({ message: "with suffix", suffix: "SFX" });

            expect(loggedMeta[0]).toMatchObject({
                message: "with suffix",
                suffix: "SFX",
            });
        });

        it("should set context from additional arguments when the Message has no context", () => {
            expect.assertions(1);

            const loggedMeta: any[] = [];
            const rawReporter = new RawReporter();

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter,
                reporters: [rawReporter],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.info({ message: "no ctx" }, "extra1", "extra2");

            expect(loggedMeta[0]).toMatchObject({
                context: ["extra1", "extra2"],
                message: "no ctx",
            });
        });

        it("should combine an array context with additional arguments", () => {
            expect.assertions(1);

            const loggedMeta: any[] = [];
            const rawReporter = new RawReporter();

            rawReporter.log = (meta) => {
                loggedMeta.push(meta);
            };

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter,
                reporters: [rawReporter],
                throttle: 1000,
                throttleMin: 5,
            });

            logger.info({ context: ["first"], message: "combined" }, "extra");

            expect(loggedMeta[0]).toMatchObject({
                context: ["first", "extra"],
                message: "combined",
            });
        });
    });

    describe("throttling", () => {
        it("should suppress duplicate spam and emit a repeated counter when the throttle resolves", () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 100,
                throttleMin: 2,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            for (let index = 0; index < 6; index += 1) {
                logger.info("dup");
            }

            vi.advanceTimersByTime(200);

            expect(consoleSpy.mock.calls.length).toBeGreaterThan(3);

            consoleSpy.mockRestore();
            vi.useRealTimers();
        });

        it("should resolve without a repeated counter when only one duplicate is suppressed", () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const logger = new PailBrowser({
                logLevel: "debug",
                processors: [],
                rawReporter: new RawReporter(),
                reporters: [new RawReporter()],
                throttle: 100,
                throttleMin: 2,
            });

            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            // throttleMin + 2 duplicates makes the suppressed count exactly one over the minimum,
            // so the resolved log carries no "repeated" marker.
            for (let index = 0; index < 4; index += 1) {
                logger.info("dup");
            }

            vi.advanceTimersByTime(200);

            expect(consoleSpy).toHaveBeenLastCalledWith("dup");

            consoleSpy.mockRestore();
            vi.useRealTimers();
        });
    });
});
