import { describe, it, expect } from "vitest";
import type { OptionDefinition } from "../../../src/@types/command";
import type { CommandLineOptions } from "command-line-args";
import listMissingArguments from "../../../src/util/list-missing-arguments";
describe("util/list-missing-arguments", () => {
    it("should return missing argument if it was not provided", () => {
        const commandLineConfig: OptionDefinition[] = [{ name: "test", type: String, required: true }];
        const parsedArguments: CommandLineOptions = {};

        const result = listMissingArguments(commandLineConfig, parsedArguments);

        expect(result).toEqual([{ name: "test", type: String, required: true }]);
    });

    it("should return empty array if required argument is provided", () => {
        const commandLineConfig: OptionDefinition[] = [{ name: "test", type: String, required: true }];
        const parsedArguments: CommandLineOptions = {
            test: "value",
        };

        const result = listMissingArguments(commandLineConfig, parsedArguments);

        expect(result).toEqual([]);
    });

    it("should set false for missing boolean argument and do not return it as missing", () => {
        const commandLineConfig: OptionDefinition[] = [{ name: "test", type: Boolean, required: true }];
        const parsedArguments: CommandLineOptions = {};

        const result = listMissingArguments(commandLineConfig, parsedArguments);

        expect(result).toEqual([]);

        // testing if test argument in parsedArguments was set to false
        expect(parsedArguments.test).toBe(false);
    });
});
