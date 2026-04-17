import { describe, expect, it } from "vitest";

import { match, matcher } from "../../src/match";

describe(match, () => {
    it("returns true when value matches a single pattern", () => {
        expect.assertions(2);

        expect(match("src/index.ts", "src/**/*.ts")).toBe(true);
        expect(match("src/index.ts", "**/*.js")).toBe(false);
    });

    it("accepts an array of patterns and matches on any", () => {
        expect.assertions(2);

        expect(match("src/index.ts", ["**/*.js", "**/*.ts"])).toBe(true);
        expect(match("src/index.ts", ["**/*.js", "**/*.jsx"])).toBe(false);
    });

    it("accepts an array of values", () => {
        expect.assertions(1);

        expect(match(["a.ts", "b.js"], "**/*.ts")).toBe(true);
    });
});

describe(matcher, () => {
    it("compiles a pattern into a reusable matcher", () => {
        expect.assertions(3);

        const isTs = matcher("**/*.ts");

        expect(isTs("a.ts")).toBe(true);
        expect(isTs("a.js")).toBe(false);
        expect(["a.ts", "b.js", "c.ts"].filter((v) => isTs(v))).toStrictEqual(["a.ts", "c.ts"]);
    });

    it("accepts an array of patterns", () => {
        expect.assertions(2);

        const isScript = matcher(["**/*.ts", "**/*.js"]);

        expect(isScript("a.ts")).toBe(true);
        expect(isScript("a.css")).toBe(false);
    });
});
