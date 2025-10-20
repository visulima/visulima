import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("type string", () => {
    it("different values", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "one", type: String }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "yeah"] })).toStrictEqual({ one: "yeah" });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one"] })).toStrictEqual({ one: null });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "3"] })).toStrictEqual({ one: "3" });
    });
});
