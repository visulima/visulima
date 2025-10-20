import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("bad input", () => {
    it("missing option value should be null", () => {
        expect.assertions(2);

        const optionDefinitions = [{ name: "colour", type: String }, { name: "files" }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--colour"] })).toEqual({
            colour: null,
        });
        expect(commandLineArgs(optionDefinitions, { argv: ["--colour", "--files", "yeah"] })).toEqual({
            colour: null,
            files: "yeah",
        });
    });

    it("handles arrays with relative paths", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "colours", type: String }];
        const argv = ["--colours", "../what", "../ever"];

        expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
            colours: ["../what", "../ever"],
        });
    });

    it("empty string added to unknown values", () => {
        expect.assertions(2);

        const optionDefinitions = [
            { name: "one", type: String },
            { name: "two", type: Number },
            { multiple: true, name: "three", type: Number },
            { name: "four", type: String },
            { name: "five", type: Boolean },
        ];
        const argv = ["--one", "", "", "--two", "0", "--three=", "", "--four=", "--five="];

        expect(() => () => {
            commandLineArgs(optionDefinitions, { argv });
        });
        expect(commandLineArgs(optionDefinitions, { argv, partial: true })).toEqual({
            _unknown: ["", "--five="],
            five: true,
            four: "",
            one: "",
            three: [0, 0],
            two: 0,
        });
    });

    it("non-strings in argv", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];
        const argv = ["--one", 1];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({ one: 1 });
    });
});
