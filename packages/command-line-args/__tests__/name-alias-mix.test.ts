import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("name alias mix", () => {
    it("one of each", () => {
        expect.assertions(4);

        const optionDefinitions = [
            { alias: "o", name: "one" },
            { alias: "t", name: "two" },
            { alias: "h", name: "three" },
            { alias: "f", name: "four" },
        ];
        // Note: --four is intentionally omitted to test that undefined options are not included in the result
        const argv = ["--one", "-t", "--three"];
        const result = commandLineArgs(optionDefinitions, { argv });

        // Note: Without explicit type: Boolean, options are treated as string-like and
        // default to null when no value is provided. To get true/false, use type: Boolean.
        // - one, two, three: present in argv with no values → null
        // - four: not in argv → undefined
        expect(result.one).toBeNull();
        expect(result.two).toBeNull();
        expect(result.three).toBeNull();
        expect(result.four).toBeUndefined();
    });
});
