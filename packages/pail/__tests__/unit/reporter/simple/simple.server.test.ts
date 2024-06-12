import SimpleReporter from "../../../../src/reporter/simple/simple.server";
import { describe, it, expect, vi } from "vitest";

describe("SimpleReporter", () => {
    it("should format and write messages correctly to stdout", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "INFO",
            date: new Date(),
            groups: ["Group1", "Group2"],
            label: "Label",
            message: "This is a sample message",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        simpleReporter.log(meta);

        expect(stdoutSpy).toHaveBeenCalled();

        stdoutSpy.mockRestore();
    });

    it("should format and write error messages correctly to stderr", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "ERROR",
            date: new Date(),
            groups: ["Group1", "Group2"],
            label: "Label",
            message: "This is an error message",
            type: {
                level: "error",
                name: "error",
            },
        };
        const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        simpleReporter.log(meta);

        expect(stderrSpy).toHaveBeenCalled();

        stderrSpy.mockRestore();
    });

    it("should update the stdout stream correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const newStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        simpleReporter.setStdout(newStdout);

        const meta = {
            badge: "INFO",
            date: new Date(),
            groups: ["Group1", "Group2"],
            label: "Label",
            message: "This is a sample message",
            type: {
                level: "informational",
                name: "info",
            },
        };

        simpleReporter.log(meta);

        expect(newStdout.write).toHaveBeenCalled();
    });

    it("should update the stderr stream correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const newStderr = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        simpleReporter.setStderr(newStderr);

        const meta = {
            badge: "ERROR",
            date: new Date(),
            groups: ["Group1", "Group2"],
            label: "Label",
            message: "This is an error message",
            type: {
                level: "error",
                name: "error",
            },
        };

        simpleReporter.log(meta);

        expect(newStderr.write).toHaveBeenCalled();
    });

    it("should handle undefined or null meta fields gracefully", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: undefined,
            date: null,
            groups: [],
            label: null,
            message: null,
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

        expect(() => simpleReporter.log(meta)).not.toThrow();

        stdoutSpy.mockRestore();
    });

    it("should handle empty or missing context array correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "INFO",
            date: new Date(),
            groups: ["Group1", "Group2"],
            label: "Label",
            message: "This is a sample message",
            context: [],
            type: {
                level: "informational",
                name: "info",
            },
        };

        const formattedMessage = simpleReporter["_formatMessage"](meta);

        expect(formattedMessage).toContain("This is a sample message");
    });

    it("should handle large messages and wrap them correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter({ messageLength: 20 });
        const meta = {
            badge: "INFO",
            date: new Date(),
            groups: ["Group1", "Group2"],
            label: "Label",
            message: "This is a very long sample message that should be wrapped correctly.",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const formattedMessage = simpleReporter["_formatMessage"](meta);

        expect(formattedMessage.split("\n").length).toBeGreaterThan(1);
    });
});
