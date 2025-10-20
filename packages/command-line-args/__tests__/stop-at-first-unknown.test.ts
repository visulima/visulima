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

        expect(result, {
            _unknown: ["a", "--two"],
            one: true,
        });
    });

    it("with a singlular defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "--", "--two", "2"];
        const result = commandLineArgs(optionDefinitions, { argv, stopAtFirstUnknown: true });

        expect(result, {
            _unknown: ["--", "--two", "2"],
            one: "1",
        });
    });

    it("with a singlular defaultOption and partial", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "--", "--two", "2"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result, {
            _unknown: ["--", "--two", "2"],
            one: "1",
        });
    });
});
