import { beforeEach, describe, expect, it, vi } from "vitest";

import { PailBrowser } from "../../src/pail.browser";
import RawReporter from "../../src/reporter/raw/raw-reporter.browser";

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
        // eslint-disable-next-line sonarjs/slow-regex
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/(.*) ms/), "Intermediate log");
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Timer run for: (.*)ms/));

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
    });
});
