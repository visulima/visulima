import type { CommandLineOptions } from "command-line-args";
import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../src/@types/command";
import listMissingArguments from "../../../src/util/data-processing/list-missing-arguments";

describe("util/list-missing-arguments", () => {
    it("should return missing argument if it was not provided", () => {
        expect.assertions(1);

        const commandLineConfig: OptionDefinition<string>[] = [{ name: "test", required: true, type: String }];
        const parsedArguments: CommandLineOptions = {};

        const result = listMissingArguments(commandLineConfig, parsedArguments);

        expect(result).toStrictEqual([{ name: "test", required: true, type: String }]);
    });

    it("should return empty array if required argument is provided", () => {
        expect.assertions(1);

        const commandLineConfig: OptionDefinition<string>[] = [{ name: "test", required: true, type: String }];
        const parsedArguments: CommandLineOptions = {
            test: "value",
        };

        const result = listMissingArguments(commandLineConfig, parsedArguments);

        expect(result).toStrictEqual([]);
    });

    it("should set false for missing boolean argument and do not return it as missing", () => {
        expect.assertions(2);

        const commandLineConfig: OptionDefinition<boolean>[] = [{ name: "test", required: true, type: Boolean }];
        const parsedArguments: CommandLineOptions = {};

        const result = listMissingArguments(commandLineConfig, parsedArguments);

        expect(result).toStrictEqual([]);

        // testing if test argument in parsedArguments was set to false
        expect(parsedArguments.test).toBe(false);
    });
});
