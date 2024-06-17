import { stderr, stdout } from "node:process";

import { describe, expect, it, vi } from "vitest";

import InteractiveManager from "../../src/interactive/interactive-manager";
import { PailServer } from "../../src/pail.server";
import RawReporter from "../../src/reporter/raw/raw.server";

describe("pailServerImpl", () => {
    it("should log messages correctly using different log levels", () => {
        expect.assertions(3);

        const pailServer = new PailServer({ reporters: [new RawReporter()], stderr, stdout });
        const logStdoutSpy = vi.spyOn(stdout, "write");
        const logStderrSpy = vi.spyOn(stderr, "write");

        pailServer.info("Info message");
        pailServer.warn("Warning message");
        pailServer.error("Error message");

        expect(logStdoutSpy).toHaveBeenCalledWith("Info message");
        expect(logStdoutSpy).toHaveBeenCalledWith("Warning message");
        expect(logStderrSpy).toHaveBeenCalledWith("Error message");
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

    it("should wrap and restore stdout and stderr streams", () => {
        expect.assertions(4);

        const pailServer = new PailServer({ stderr, stdout });
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalStdoutWrite = stdout.write;
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalStderrWrite = stderr.write;

        pailServer.wrapStd();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(stdout.write).not.toBe(originalStdoutWrite);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(stderr.write).not.toBe(originalStderrWrite);

        pailServer.restoreStd();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(stdout.write).toBe(originalStdoutWrite);
        // eslint-disable-next-line @typescript-eslint/unbound-method
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

        expect(logStdoutSpy).toHaveBeenCalledWith("This is the outer level");
        expect(logStdoutSpy).toHaveBeenCalledWith("    Level 2");
        expect(logStdoutSpy).toHaveBeenCalledWith("    Hello world!");
        expect(logStdoutSpy).toHaveBeenCalledWith("        Level 3");
        expect(logStdoutSpy).toHaveBeenCalledWith("        More of level 3");
        expect(logStdoutSpy).toHaveBeenCalledWith("    Back to level 2");
        expect(logStdoutSpy).toHaveBeenCalledWith("Back to the outer level");
    });
});
