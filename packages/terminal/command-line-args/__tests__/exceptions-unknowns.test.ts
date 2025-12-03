import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { UnknownOptionError, UnknownValueError } from "../src/errors";

describe("exceptions unknowns", () => {
    it("unknown option", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--one", "--two"] })).toThrow(UnknownOptionError);
    });

    it("1 unknown option, 1 unknown value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--one", "2", "--two", "two"] })).toThrow(UnknownOptionError);
    });

    it("unknown alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["-a", "2"] })).toThrow(UnknownOptionError);
    });

    it("unknown combined aliases", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["-sdf"] })).toThrow(UnknownOptionError);
    });

    it("unknown value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["--one", "arg1", "arg2"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(UnknownValueError);
    });

    it("unknown value with singular defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }];
        const argv = ["arg1", "arg2"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(UnknownValueError);
    });

    it("no unknown value exception with multiple defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, multiple: true, name: "one" }];
        const argv = ["arg1", "arg2"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            one: ["arg1", "arg2"],
        });
    });

    it("non-multiple defaultOption throws UnknownValueError when multiple positional values provided", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: true, name: "file" },
            { name: "one", type: Boolean },
            { name: "two", type: Boolean },
        ];
        const argv = ["--two", "file1", "--one", "file2"];

        // Note: Boolean flags (--two, --one) don't consume the following values.
        // Both positional values (file1, file2) bind to the non-multiple defaultOption.
        // The first value (file1) is consumed, but the second value (file2) throws UnknownValueError.
        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(UnknownValueError);
    });
});
