import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("type none", () => {
    const definitions = [{ name: "one" }, { name: "two" }];

    it("no argv values", () => {
        expect.assertions(1);

        const argv = [];
        const result = commandLineArgs(definitions, { argv });

        expect(result).toStrictEqual({});
    });

    it("just names, no values", () => {
        expect.assertions(1);

        const argv = ["--one", "--two"];
        const result = commandLineArgs(definitions, { argv });

        expect(result).toStrictEqual({
            one: null,
            two: null,
        });
    });

    it("just names, one value, one unpassed value", () => {
        expect.assertions(1);

        const argv = ["--one", "one", "--two"];
        const result = commandLineArgs(definitions, { argv });

        expect(result).toStrictEqual({
            one: "one",
            two: null,
        });
    });

    it("just names, two values", () => {
        expect.assertions(1);

        const argv = ["--one", "one", "--two", "two"];
        const result = commandLineArgs(definitions, { argv });

        expect(result).toStrictEqual({
            one: "one",
            two: "two",
        });
    });
});
