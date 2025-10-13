import { describe, expect, it, vi } from "vitest";

import { PailBrowser } from "../../src/pail.browser";
import RawReporter from "../../src/reporter/raw/raw.browser";

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

        expect(consoleSpy).toHaveBeenNthCalledWith(1, "Info message");
        expect(consoleSpy).toHaveBeenNthCalledWith(2, "Custom log message", { key: "value" });

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

        expect(consoleSpy).toHaveBeenNthCalledWith(1, "Initialized timer...");
        expect(consoleSpy).toHaveBeenNthCalledWith(2, expect.stringMatching(/(.*) ms/), "Intermediate log");
        expect(consoleSpy).toHaveBeenNthCalledWith(3, expect.stringMatching(/Timer run for: (.*)ms/));

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

        expect(consoleSpy).toHaveBeenNthCalledWith(1, undefined);
        expect(consoleSpy).toHaveBeenNthCalledWith(2, null);

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

        expect(consoleSpy).toHaveBeenNthCalledWith(2, "Timer 'testTimer' already exists");

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
});
