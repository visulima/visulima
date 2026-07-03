import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../src/types/command";
import { addNegatableOptions, mapImpliedOptions, mapNegatableOptions, processOptionNames } from "../../src/util/command-processing/option-processor";

describe("option-processor", () => {
    describe(processOptionNames, () => {
        it("should add camelCase names to options", () => {
            expect.assertions(2);

            const command = {
                options: [
                    { name: "test-option", type: String } as OptionDefinition<string>,
                    { name: "another_option", type: Boolean } as OptionDefinition<boolean>,
                ],
            };

            processOptionNames(command);

            // eslint-disable-next-line no-underscore-dangle
            expect(command.options[0].__camelCaseName__).toBe("testOption");
            // eslint-disable-next-line no-underscore-dangle
            expect(command.options[1].__camelCaseName__).toBe("anotherOption");
        });
    });

    describe(addNegatableOptions, () => {
        it("should add negated options for boolean flags starting with no-", () => {
            expect.assertions(3);

            const command = {
                name: "test",
                options: [{ name: "no-verbose", type: Boolean } as OptionDefinition<boolean>],
            };

            addNegatableOptions(command);

            expect(command.options).toHaveLength(2);
            expect(command.options[1]?.name).toBe("verbose");
            expect(command.options[1]?.defaultValue).toBe(true);
        });

        it("should not add negated options for non-boolean types", () => {
            expect.assertions(1);

            const command = {
                name: "test",
                options: [{ name: "no-input", type: String } as OptionDefinition<string>],
            };

            expect(() => {
                addNegatableOptions(command);
            }).toThrow("Cannot add negated option \"no-input\" to command \"test\" because it is not a boolean.");
        });

        it("should not duplicate existing options", () => {
            expect.assertions(1);

            const command = {
                name: "test",
                options: [{ name: "no-verbose", type: Boolean } as OptionDefinition<boolean>, { name: "verbose", type: Boolean } as OptionDefinition<boolean>],
            };

            addNegatableOptions(command);

            expect(command.options).toHaveLength(2); // Should not add duplicate
        });
    });

    describe(mapNegatableOptions, () => {
        it("should map no-* options to their negated counterparts", () => {
            expect.assertions(2);

            const toolbox = {
                options: {
                    noVerbose: false,
                },
            };

            const command = {
                options: [{ name: "no-verbose", type: Boolean } as OptionDefinition<boolean>],
            };

            processOptionNames(command);
            mapNegatableOptions(toolbox, command);

            expect(toolbox.options.verbose).toBe(true);
            // eslint-disable-next-line no-underscore-dangle
            expect(command.options[0].__negated__).toBe(true);
        });

        it("should return early when the command has no options", () => {
            expect.assertions(1);

            const toolbox = { options: { verbose: true } };
            const command = { options: [] as OptionDefinition<boolean>[] };

            mapNegatableOptions(toolbox, command);

            // Untouched: no negatable mapping took place.
            expect(toolbox.options).toStrictEqual({ verbose: true });
        });

        it("skips negated keys whose camelCase form is shorter than three characters", () => {
            expect.assertions(2);

            // The option name "no-" camelCases to "no", so its parsed key has no third
            // character, exercising the `!thirdChar` continue branch.
            const toolbox = {
                options: {
                    no: false,
                },
            };

            const command = {
                options: [{ name: "no-", type: Boolean } as OptionDefinition<boolean>],
            };

            processOptionNames(command);
            mapNegatableOptions(toolbox, command);

            // The key is left in place because the branch `continue`d before mapping/deletion.
            expect(toolbox.options).toHaveProperty("no", false);
            // eslint-disable-next-line no-underscore-dangle
            expect(command.options[0].__negated__).toBeUndefined();
        });
    });

    describe(mapImpliedOptions, () => {
        it("should apply implied options when option is present", () => {
            expect.assertions(2);

            const toolbox = {
                options: {
                    production: true,
                },
            };

            const command = {
                options: [
                    {
                        implies: { minify: true, sourcemap: false },
                        name: "production",
                        type: Boolean,
                    } as OptionDefinition<boolean>,
                ],
            };

            processOptionNames(command);
            mapImpliedOptions(toolbox, command);

            expect(toolbox.options.minify).toBe(true);
            expect(toolbox.options.sourcemap).toBe(false);
        });

        it("should not override explicitly set options", () => {
            expect.assertions(2);

            const toolbox = {
                options: {
                    production: true,
                    sourcemap: true, // Explicitly set
                },
            };

            const command = {
                options: [
                    {
                        implies: { minify: true, sourcemap: false },
                        name: "production",
                        type: Boolean,
                    } as OptionDefinition<boolean>,
                ],
            };

            processOptionNames(command);
            mapImpliedOptions(toolbox, command);

            expect(toolbox.options.minify).toBe(true);
            expect(toolbox.options.sourcemap).toBe(true); // Should not be overridden
        });

        it("should return early when the command has no options", () => {
            expect.assertions(1);

            const toolbox = { options: { production: true } };
            const command = { options: [] as OptionDefinition<boolean>[] };

            mapImpliedOptions(toolbox, command);

            expect(toolbox.options).toStrictEqual({ production: true });
        });
    });
});
