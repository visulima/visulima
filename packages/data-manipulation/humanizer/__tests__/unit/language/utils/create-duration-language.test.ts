import { describe, expect, it } from "vitest";

import createDurationLanguage from "../../../../src/language/util/create-duration-language";

describe(createDurationLanguage, () => {
    it("should only set the required unit properties when no optional arguments are given", () => {
        expect.assertions(7);

        const language = createDurationLanguage("y", "mo", "w", "d", "h", "m", "s", "ms");

        expect(language).toStrictEqual({
            d: "d",
            h: "h",
            m: "m",
            mo: "mo",
            ms: "ms",
            s: "s",
            w: "w",
            y: "y",
        });
        expect(language.future).toBeUndefined();
        expect(language.past).toBeUndefined();
        expect(language.decimal).toBeUndefined();
        expect(language.unitMap).toBeUndefined();
        expect(language.groupSeparator).toBeUndefined();
        expect(language.placeholderSeparator).toBeUndefined();
    });

    it("should set every optional property when all arguments are provided", () => {
        expect.assertions(6);

        const unitMap = { h: "h" } as const;
        const language = createDurationLanguage("y", "mo", "w", "d", "h", "m", "s", "ms", "in %s", "%s ago", ",", unitMap, " ", "_");

        expect(language.future).toBe("in %s");
        expect(language.past).toBe("%s ago");
        expect(language.decimal).toBe(",");
        expect(language.unitMap).toBe(unitMap);
        expect(language.groupSeparator).toBe(" ");
        expect(language.placeholderSeparator).toBe("_");
    });
});
