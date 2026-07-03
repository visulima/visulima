import { describe, expect, it } from "vitest";

import CommandValidationError from "../../../src/errors/command-validation-error";
import ConflictingOptionsError from "../../../src/errors/conflicting-options-error";
import type { Command as ICommand, OptionDefinition } from "../../../src/types/command";
import { validateConflictingOptions, validateDuplicateOptions, validateRequiredOptions } from "../../../src/util/command-processing/command-validation";

const makeCommand = (overrides: Partial<ICommand>): ICommand => {
    return {
        execute: () => {},
        name: "test",
        ...overrides,
    };
};

const MULTIPLE_SUGGESTIONS_RE = /did you mean --color(s)? or --color/;

describe("command-validation", () => {
    describe(validateRequiredOptions, () => {
        it("throws CommandValidationError when a required option is missing", () => {
            expect.assertions(1);

            const command = makeCommand({
                options: [{ name: "token", required: true, type: String }],
            });

            const run = (): void => {
                validateRequiredOptions(command.options ?? [], { _all: {} }, command);
            };

            expect(run).toThrow(CommandValidationError);
        });

        it("reports unknown options as arguments when the value does not start with --", () => {
            expect.assertions(1);

            const command = makeCommand({ options: [] });

            const run = (): void => {
                validateRequiredOptions([], { _all: {}, _unknown: ["bogus"] }, command);
            };

            expect(run).toThrow("Found unknown argument \"bogus\"");
        });

        it("suggests a single close alternative for an unknown option", () => {
            expect.assertions(1);

            const command = makeCommand({
                options: [{ name: "verbose", type: Boolean }],
            });

            const run = (): void => {
                validateRequiredOptions(command.options ?? [], { _all: {}, _unknown: ["--verbos"] }, command);
            };

            expect(run).toThrow("did you mean --verbose?");
        });

        it("suggests multiple alternatives for an unknown option", () => {
            expect.assertions(1);

            const command = makeCommand({
                options: [
                    { name: "color", type: Boolean },
                    { name: "colors", type: Boolean },
                ],
            });

            const run = (): void => {
                validateRequiredOptions(command.options ?? [], { _all: {}, _unknown: ["--colur"] }, command);
            };

            expect(run).toThrow(MULTIPLE_SUGGESTIONS_RE);
        });

        it("does not validate unknown options when the command takes a positional argument", () => {
            expect.assertions(1);

            const command = makeCommand({
                argument: { name: "file", type: String },
                options: [],
            });

            const run = (): void => {
                validateRequiredOptions([], { _all: {}, _unknown: ["--bogus"] }, command);
            };

            expect(run).not.toThrow();
        });
    });

    describe(validateConflictingOptions, () => {
        it("throws when two single-string conflicting options are both set", () => {
            expect.assertions(1);

            const options: OptionDefinition<unknown>[] = [{ conflicts: "json", name: "yaml", type: Boolean }];
            const command = makeCommand({ options });

            const run = (): void => {
                validateConflictingOptions(options, { json: true, yaml: true }, command);
            };

            expect(run).toThrow(ConflictingOptionsError);
        });

        it("throws when an array-based conflict is triggered", () => {
            expect.assertions(1);

            const options: OptionDefinition<unknown>[] = [{ conflicts: ["json", "xml"], name: "yaml", type: Boolean }];
            const command = makeCommand({ options });

            const run = (): void => {
                validateConflictingOptions(options, { xml: true, yaml: true }, command);
            };

            expect(run).toThrow(ConflictingOptionsError);
        });

        it("does not throw when only one of the conflicting options is set", () => {
            expect.assertions(1);

            const options: OptionDefinition<unknown>[] = [{ conflicts: "json", name: "yaml", type: Boolean }];
            const command = makeCommand({ options });

            const run = (): void => {
                validateConflictingOptions(options, { yaml: true }, command);
            };

            expect(run).not.toThrow();
        });
    });

    describe(validateDuplicateOptions, () => {
        it("returns early when options is not an array", () => {
            expect.assertions(1);

            const command = makeCommand({ options: undefined });

            const run = (): void => {
                validateDuplicateOptions(command);
            };

            expect(run).not.toThrow();
        });

        it("throws for duplicate option names", () => {
            expect.assertions(1);

            const command = makeCommand({
                options: [
                    { name: "verbose", type: Boolean },
                    { name: "verbose", type: Boolean },
                ],
            });

            const run = (): void => {
                validateDuplicateOptions(command);
            };

            expect(run).toThrow("Duplicate option name \"verbose\"");
        });

        it("throws for a string alias used by two options", () => {
            expect.assertions(1);

            const command = makeCommand({
                options: [
                    { alias: "v", name: "verbose", type: Boolean },
                    { alias: "v", name: "version", type: Boolean },
                ],
            });

            const run = (): void => {
                validateDuplicateOptions(command);
            };

            expect(run).toThrow("Duplicate option alias \"-v\"");
        });

        it("throws for an array alias entry shared by two options", () => {
            expect.assertions(1);

            const command = makeCommand({
                options: [
                    { alias: ["d", "x"], name: "debug", type: Boolean },
                    { alias: ["x"], name: "extra", type: Boolean },
                ],
            });

            const run = (): void => {
                validateDuplicateOptions(command);
            };

            expect(run).toThrow("Duplicate option alias \"-x\"");
        });

        it("does not throw for unique names and aliases", () => {
            expect.assertions(1);

            const command = makeCommand({
                options: [
                    { alias: "v", name: "verbose", type: Boolean },
                    { alias: ["d"], name: "debug", type: Boolean },
                ],
            });

            const run = (): void => {
                validateDuplicateOptions(command);
            };

            expect(run).not.toThrow();
        });
    });
});
