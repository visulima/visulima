import { describe, expect, it } from "vitest";

import CerebroError from "../src/errors/cerebro-error";
import CommandNotFoundError from "../src/errors/command-not-found-error";
import CommandValidationError from "../src/errors/command-validation-error";
import ConflictingOptionsError from "../src/errors/conflicting-options-error";
import { ErrorCodes } from "../src/errors/error-codes";
import InvalidArgumentError from "../src/errors/invalid-argument-error";
import PluginError from "../src/errors/plugin-error";
import SecurityError from "../src/errors/security-error";
import UnknownOptionError from "../src/errors/unknown-option-error";

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

    describe(UnknownOptionError, () => {
        it("should use singular 'option' wording for a single unknown option", () => {
            expect.assertions(5);

            const error = new UnknownOptionError(["--foo"]);

            expect(error.message).toBe("Found unknown option: --foo");
            expect(error.code).toBe("UNKNOWN_OPTION");
            expect(error.name).toBe("UnknownOptionError");
            expect(error.unknownOptions).toStrictEqual(["--foo"]);
            expect(error.hint).toBeUndefined();
        });

        it("should use plural 'options' wording for multiple unknown options", () => {
            expect.assertions(2);

            const error = new UnknownOptionError(["--foo", "--bar"]);

            expect(error.message).toBe("Found unknown options: --foo, --bar");
            expect(error.unknownOptions).toStrictEqual(["--foo", "--bar"]);
        });

        it("should add a hint when suggestions are provided", () => {
            expect.assertions(2);

            const error = new UnknownOptionError(["--fooo"], ["--foo", "--food"]);

            expect(error.hint).toBe("Did you mean: --foo, --food?");
            expect(error.context?.suggestions).toStrictEqual(["--foo", "--food"]);
        });

        it("should not add a hint when suggestions are an empty array", () => {
            expect.assertions(1);

            const error = new UnknownOptionError(["--foo"], []);

            expect(error.hint).toBeUndefined();
        });
    });

    describe(InvalidArgumentError, () => {
        it("should create error with argument name and message", () => {
            expect.assertions(4);

            const error = new InvalidArgumentError("count", "must be a number");

            expect(error.message).toBe("must be a number");
            expect(error.code).toBe("INVALID_ARGUMENT");
            expect(error.name).toBe("InvalidArgumentError");
            expect(error.argumentName).toBe("count");
        });
    });

    describe(SecurityError, () => {
        it("should create error with custom code and context", () => {
            expect.assertions(4);

            const context = { reason: "traversal" };
            const error = new SecurityError("Path traversal detected", "SECURITY_ERROR", context);

            expect(error.message).toBe("Path traversal detected");
            expect(error.code).toBe("SECURITY_ERROR");
            expect(error.name).toBe("SecurityError");
            expect(error.context).toBe(context);
        });
    });

    describe("errorCodes", () => {
        it("should expose stable string constants keyed by their own name", () => {
            expect.assertions(2);

            expect(ErrorCodes.SECURITY_ERROR).toBe("SECURITY_ERROR");
            expect(ErrorCodes.UNKNOWN_OPTION).toBe("UNKNOWN_OPTION");
        });
    });
});
