import { describe, expect, it } from "vitest";

import CerebroError from "../src/errors/cerebro-error";
import CommandNotFoundError from "../src/errors/command-not-found-error";
import CommandValidationError from "../src/errors/command-validation-error";
import ConflictingOptionsError from "../src/errors/conflicting-options-error";
import PluginError from "../src/errors/plugin-error";

describe("errors", () => {
    describe(CerebroError, () => {
        it("should create error with message and code", () => {
            expect.assertions(3);

            const error = new CerebroError("Test message", "TEST_CODE");

            expect(error.message).toBe("Test message");
            expect(error.code).toBe("TEST_CODE");
            expect(error.name).toBe("CerebroError");
        });

        it("should include context when provided", () => {
            expect.assertions(1);

            const context = { key: "value" };
            const error = new CerebroError("Test message", "TEST_CODE", context);

            expect(error.context).toBe(context);
        });
    });

    describe(CommandNotFoundError, () => {
        it("should create error with command name", () => {
            expect.assertions(3);

            const error = new CommandNotFoundError("unknown-command");

            expect(error.message).toBe("Command \"unknown-command\" not found");
            expect(error.code).toBe("COMMAND_NOT_FOUND");
            expect(error.commandName).toBe("unknown-command");
        });

        it("should include suggestions when provided", () => {
            expect.assertions(2);

            const error = new CommandNotFoundError("unkown", ["unknown"]);

            expect(error.message).toContain("Did you mean");
            expect(error.context?.suggestions).toStrictEqual(["unknown"]);
        });
    });

    describe(CommandValidationError, () => {
        it("should create error with command and missing options", () => {
            expect.assertions(4);

            const error = new CommandValidationError("test", ["option1", "option2"]);

            expect(error.message).toBe("Command \"test\" is missing required options: option1, option2");
            expect(error.code).toBe("COMMAND_VALIDATION_ERROR");
            expect(error.commandName).toBe("test");
            expect(error.missingOptions).toStrictEqual(["option1", "option2"]);
        });
    });

    describe(ConflictingOptionsError, () => {
        it("should create error with conflicting options", () => {
            expect.assertions(4);

            const error = new ConflictingOptionsError("option1", "option2");

            expect(error.message).toBe("Options \"option1\" and \"option2\" cannot be used together");
            expect(error.code).toBe("CONFLICTING_OPTIONS");
            expect(error.option1).toBe("option1");
            expect(error.option2).toBe("option2");
        });
    });

    describe(PluginError, () => {
        it("should create error with plugin name and message", () => {
            expect.assertions(3);

            const error = new PluginError("test-plugin", "Plugin failed");

            expect(error.message).toBe("Plugin \"test-plugin\" error: Plugin failed");
            expect(error.code).toBe("PLUGIN_ERROR");
            expect(error.pluginName).toBe("test-plugin");
        });

        it("should include original error as cause when provided", () => {
            expect.assertions(2);

            const originalError = new Error("Original error");

            originalError.stack = "Original stack";
            const error = new PluginError("test-plugin", "Plugin failed", originalError);

            expect(error.cause).toBe(originalError);
            expect(error.context?.originalError).toBe(originalError);
        });
    });
});
