import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

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
});
