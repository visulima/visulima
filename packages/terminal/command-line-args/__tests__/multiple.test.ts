import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("multiple", () => {
    it("empty argv", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "one" }];
        const argv = [];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({});
    });

    it("boolean, empty argv", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "one", type: Boolean }];
        const argv = [];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({});
    });

    it("string unset with defaultValue", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultValue: 1, multiple: true, name: "one" }];
        const argv = [];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({ one: [1] });
    });

    it("string", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "one" }];
        const argv = ["--one", "1", "2"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["1", "2"],
        });
    });

    it("string, --option=value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "one" }];
        const argv = ["--one=1", "--one=2"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["1", "2"],
        });
    });

    it("string, --option=value mix", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "one" }];
        const argv = ["--one=1", "--one=2", "3"];
        const result = commandLineArgs(optionDefinitions, { argv });

        // Note: multiple: true allows the option to consume following positional arguments
        // even without defaultOption: true. The positional "3" is consumed by --one because
        // multiple options greedily collect all following positional arguments.
        expect(result).toStrictEqual({
            one: ["1", "2", "3"],
        });
    });

    it("string, defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, multiple: true, name: "one" }];
        const argv = ["1", "2"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            one: ["1", "2"],
        });
    });
});
