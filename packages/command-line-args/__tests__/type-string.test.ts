import { describe, expect, it } from "vitest";

import commandLineArgs from "../src";

describe("type string", () => {
    it("different values", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "one", type: String }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "yeah"] }), { one: "yeah" });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one"] }), { one: null });
        expect(commandLineArgs(optionDefinitions, { argv: ["--one", "3"] }), { one: "3" });
    });
});
