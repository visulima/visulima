import { describe, expect, it } from "vitest";

import commandLineArgs from "../src";

describe("name alias mix", () => {
    it("one of each", () => {
        expect.assertions(4);

        const optionDefinitions = [
            { alias: "o", name: "one" },
            { alias: "t", name: "two" },
            { alias: "h", name: "three" },
            { alias: "f", name: "four" },
        ];
        const argv = ["--one", "-t", "--three"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result.one).toBeNull();
        expect(result.two).toBeNull();
        expect(result.three).toBeNull();
        expect(result.four).toBeUndefined();
    });
});
