import { describe, expect, it } from "vitest";

import type { ColorToken } from "../../../src/apps/tailwind/analyze";
import { groupColors, isNumericScale } from "../../../src/apps/tailwind/analyze";

const token = (name: string): ColorToken => {
    return { cssVar: `--color-${name}`, name, value: "#000" };
};

describe(isNumericScale, () => {
    it("accepts a name ending in a number", () => {
        expect.hasAssertions();

        expect(isNumericScale("red-500")).toBe(true);
    });

    it("rejects a name with no numeric suffix", () => {
        expect.hasAssertions();

        expect(isNumericScale("primary")).toBe(false);
    });

    it("rejects a hyphenated name whose suffix is not numeric", () => {
        expect.hasAssertions();

        expect(isNumericScale("primary-foreground")).toBe(false);
    });
});

describe(groupColors, () => {
    it("keeps a colour with no numeric suffix as semantic", () => {
        expect.hasAssertions();

        const { scales, semantic } = groupColors([token("primary"), token("primary-foreground")]);

        expect(semantic.map((entry) => entry.name)).toStrictEqual(["primary", "primary-foreground"]);
        expect(scales.size).toBe(0);
    });

    it("groups a numeric scale under its base name", () => {
        expect.hasAssertions();

        const { scales } = groupColors([token("red-500"), token("red-100"), token("blue-500")]);

        expect([...scales.keys()]).toStrictEqual(["red", "blue"]);
    });

    it("orders a scale numerically rather than lexically", () => {
        expect.hasAssertions();

        // Lexical order would put 100 before 50 and 950 before 100.
        const { scales } = groupColors([token("red-950"), token("red-50"), token("red-100"), token("red-900")]);

        expect(scales.get("red")?.map((entry) => entry.name)).toStrictEqual(["red-50", "red-100", "red-900", "red-950"]);
    });
});
