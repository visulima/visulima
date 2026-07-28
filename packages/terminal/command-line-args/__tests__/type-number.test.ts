import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { UnknownOptionError } from "../src/errors";

describe("type number", () => {
    it("different values", () => {
        expect.assertions(4);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "1"] })).toStrictEqual({ one: 1 });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one"] })).toStrictEqual({ one: null });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "-1"] })).toStrictEqual({ one: -1 });

        const result = commandLineArgs(optionDefinitions, { argv: ["--one", "asdf"] });

        expect(Number.isNaN(result.one)).toBe(true);
    });

    it("number multiple: 1", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "array", type: Number }];
        const argv = ["--array", "1", "2", "3"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            array: [1, 2, 3],
        });
    });

    it("number multiple: 2", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "array", type: Number }];
        const argv = ["--array", "1", "--array", "2", "--array", "3"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            array: [1, 2, 3],
        });
    });

    it("numeric long-option name is captured as the value when a Number option exists", () => {
        expect.assertions(2);

        const optionDefinitions = [{ name: "size", type: Number }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--5"] })).toStrictEqual({ size: 5 });
        expect(commandLineArgs(optionDefinitions, { argv: ["--42"] })).toStrictEqual({ size: 42 });
    });

    it("numeric long-option name throws when no Number option is defined", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "size" }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--5"] })).toThrow(UnknownOptionError);
    });

    it("multi-digit and decimal negative numbers are parsed as values", () => {
        expect.assertions(2);

        const optionDefinitions = [{ name: "num", type: Number }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--num", "-12"] })).toStrictEqual({ num: -12 });
        expect(commandLineArgs(optionDefinitions, { argv: ["--num", "-1.5"] })).toStrictEqual({ num: -1.5 });
    });
});
