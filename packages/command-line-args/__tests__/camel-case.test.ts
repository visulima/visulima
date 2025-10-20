import { describe, expect, it } from "vitest";

import commandLineArgs from "../src";

describe("camel case", () => {
    it("regular", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one-two" }, { name: "three", type: Boolean }];
        const argv = ["--one-two", "1", "--three"];
        const result = commandLineArgs(optionDefinitions, { argv, camelCase: true });

        expect(result, {
            oneTwo: "1",
            three: true,
        });
    });

    it("grouped", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { group: "a", name: "one-one" },
            { group: "a", name: "two-two" },
            { group: "b", name: "three-three", type: Boolean },
            { name: "four-four" },
        ];
        const argv = ["--one-one", "1", "--two-two", "2", "--three-three", "--four-four", "4"];
        const result = commandLineArgs(optionDefinitions, { argv, camelCase: true });

        expect(result, {
            _all: {
                fourFour: "4",
                oneOne: "1",
                threeThree: true,
                twoTwo: "2",
            },
            _none: {
                fourFour: "4",
            },
            a: {
                oneOne: "1",
                twoTwo: "2",
            },
            b: {
                threeThree: true,
            },
        });
    });

    it("grouped with unknowns", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { group: "a", name: "one-one" },
            { group: "a", name: "two-two" },
            { group: "b", name: "three-three", type: Boolean },
            { name: "four-four" },
        ];
        const argv = ["--one-one", "1", "--two-two", "2", "--three-three", "--four-four", "4", "--five"];
        const result = commandLineArgs(optionDefinitions, { argv, camelCase: true, partial: true });

        expect(result, {
            _all: {
                fourFour: "4",
                oneOne: "1",
                threeThree: true,
                twoTwo: "2",
            },
            _none: {
                fourFour: "4",
            },
            _unknown: ["--five"],
            a: {
                oneOne: "1",
                twoTwo: "2",
            },
            b: {
                threeThree: true,
            },
        });
    });
});
