import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("exceptions unknowns", () => {
    it("unknown option", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--one", "--two"] })).toThrow();
    });

    it("1 unknown option, 1 unknown value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--one", "2", "--two", "two"] })).toThrow();
    });

    it("unknown alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["-a", "2"] })).toThrow();
    });

    it("unknown combined aliases", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["-sdf"] })).toThrow();
    });

    it("unknown value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["--one", "arg1", "arg2"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("unknown value with singular defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }];
        const argv = ["arg1", "arg2"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("no unknown value exception with multiple defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, multiple: true, name: "one" }];
        const argv = ["arg1", "arg2"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            one: ["arg1", "arg2"],
        });
    });

    it("non-multiple defaultOption should take first value 2", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: true, name: "file" },
            { name: "one", type: Boolean },
            { name: "two", type: Boolean },
        ];
        const argv = ["--two", "file1", "--one", "file2"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });
});
