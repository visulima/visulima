import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { UnknownOptionError } from "../src/errors";

describe("--no-<flag> boolean negation", () => {
    it("sets a Boolean option to false when negation is enabled", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultValue: true, name: "verbose", type: Boolean }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--no-verbose"], negation: true })).toStrictEqual({ verbose: false });
    });

    it("leaves the default value intact when neither flag is passed", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultValue: true, name: "verbose", type: Boolean }];

        expect(commandLineArgs(optionDefinitions, { argv: [], negation: true })).toStrictEqual({ verbose: true });
    });

    it("treats --verbose as true and --no-verbose as false", () => {
        expect.assertions(2);

        const optionDefinitions = [{ name: "verbose", type: Boolean }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--verbose"], negation: true })).toStrictEqual({ verbose: true });
        expect(commandLineArgs(optionDefinitions, { argv: ["--no-verbose"], negation: true })).toStrictEqual({ verbose: false });
    });

    it("does not negate non-Boolean options", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "color", type: String }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--no-color"], negation: true })).toThrow(UnknownOptionError);
    });

    it("throws UnknownOptionError for --no-<flag> when negation is disabled", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "verbose", type: Boolean }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--no-verbose"] })).toThrow(UnknownOptionError);
    });

    it("prefers an explicitly-defined no- option over implicit negation", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { name: "verbose", type: Boolean },
            { name: "no-verbose", type: Boolean },
        ];

        expect(commandLineArgs(optionDefinitions, { argv: ["--no-verbose"], negation: true })).toStrictEqual({ "no-verbose": true });
    });
});
