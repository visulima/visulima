import { describe, expect, it } from "vitest";

import { escapeRegExp, findStringOccurrences, hasChinese, hasPunctuationOrSpace, inRange } from "../../src/utilities";

describe(escapeRegExp, () => {
    it("should escape characters with special meaning in regular expressions", () => {
        expect.assertions(2);
        expect(escapeRegExp("a.b*c+")).toBe(String.raw`a\.b\*c\+`);
        expect(escapeRegExp("(group)[set]{n}")).toBe(String.raw`\(group\)\[set\]\{n\}`);
    });
});

describe(inRange, () => {
    it("should return true when the number falls within any interval", () => {
        expect.assertions(2);
        expect(inRange(5, [[1, 3], [4, 6]])).toBe(true);
        expect(inRange(1, [[1, 3]])).toBe(true);
    });

    it("should return false when the number is outside all intervals", () => {
        expect.assertions(2);
        expect(inRange(7, [[1, 3], [4, 6]])).toBe(false);
        expect(inRange(0, [[1, 3]])).toBe(false);
    });
});

describe(hasChinese, () => {
    it("should detect Han-script characters", () => {
        expect.assertions(2);
        expect(hasChinese("你好")).toBe(true);
        expect(hasChinese("hello")).toBe(false);
    });
});

describe(hasPunctuationOrSpace, () => {
    it("should detect punctuation or whitespace", () => {
        expect.assertions(2);
        expect(hasPunctuationOrSpace("a b")).toBe(true);
        expect(hasPunctuationOrSpace("abc")).toBe(false);
    });
});

describe(findStringOccurrences, () => {
    it("should return an empty array when needles is not an array", () => {
        expect.assertions(1);

        expect(findStringOccurrences("hello", "ll" as never)).toStrictEqual([]);
    });

    it("should skip non-string and empty needles", () => {
        expect.assertions(1);

        expect(findStringOccurrences("hello", ["", 5 as never, "l"])).toStrictEqual([[2, 3]]);
    });

    it("should return an empty array when no needle matches", () => {
        expect.assertions(1);
        expect(findStringOccurrences("hello", ["xyz"])).toStrictEqual([]);
    });

    it("should merge overlapping or adjacent ranges", () => {
        expect.assertions(1);
        expect(findStringOccurrences("aaaa", ["aa"])).toStrictEqual([[0, 3]]);
    });

    it("should keep disjoint ranges separate", () => {
        expect.assertions(1);
        expect(findStringOccurrences("a_b_a", ["a"])).toStrictEqual([[0, 0], [4, 4]]);
    });
});
