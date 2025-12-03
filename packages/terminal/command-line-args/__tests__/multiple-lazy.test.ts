import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { UnknownValueError } from "../src/errors";

describe("multiple lazy", () => {
    it("string", () => {
        expect.assertions(1);

        const argv = ["--one", "a", "--one", "b", "--one", "d"];
        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["a", "b", "d"],
        });
    });

    it("string unset with defaultValue", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultValue: 1, lazyMultiple: true, name: "one" }];
        const argv = [];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({ one: [1] });
    });

    it("string, --option=value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const argv = ["--one=1", "--one=2"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["1", "2"],
        });
    });

    it("string, --option=value mix", () => {
        expect.assertions(1);

        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const argv = ["--one=1", "--one=2", "--one", "3"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["1", "2", "3"],
        });
    });

    it("string, defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, lazyMultiple: true, name: "one" }];
        const argv = ["1", "2"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["1", "2"],
        });
    });

    it("greedy style, string", () => {
        expect.assertions(1);

        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const argv = ["--one", "1", "2"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(UnknownValueError);
    });

    it("greedy style, string, --option=value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const argv = ["--one=1", "--one=2"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["1", "2"],
        });
    });

    it("greedy style, string, --option=value mix", () => {
        expect.assertions(1);

        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const argv = ["--one=1", "--one=2", "3"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(UnknownValueError);
    });
});
