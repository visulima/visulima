import { describe, expect, it } from "vitest";

const { default: commandLineArgs } = require("../dist/index.js");

describe("commonJS build", () => {
    it("commonJS build works correctly", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "one", type: String }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "yeah"] })).toEqual({ one: "yeah" });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one"] })).toEqual({ one: null });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "3"] })).toEqual({ one: "3" });
    });
});
