import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("stop at first unknown", () => {
    it("stopAtFirstUnknown", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { name: "one", type: Boolean },
            { name: "two", type: Boolean },
        ];
        const argv = ["--one", "a", "--two"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["a", "--two"],
            one: true,
        });
    });

    it("with a singular defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "--", "--two", "2"];
        const result = commandLineArgs(optionDefinitions, { argv, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["--", "--two", "2"],
            one: "1",
        });
    });

    it("with a singular defaultOption and partial", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "--", "--two", "2"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["--", "--two", "2"],
            one: "1",
        });
    });

    it("with short option group should use correct argv index", () => {
        expect.assertions(1);

        // Test that stopAtFirstUnknown uses token.index (argv position) not token array index
        // When -ab is tokenized, it creates multiple tokens but they map to argv index 0
        // The _unknown should slice from the correct argv position
        const optionDefinitions = [
            { alias: "a", name: "alpha", type: Boolean },
            { alias: "b", name: "beta", type: Boolean },
        ];
        const argv = ["-ab", "unknown"];
        const result = commandLineArgs(optionDefinitions, { argv, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["unknown"],
            alpha: true,
            beta: true,
        });
    });
});
