/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";

import { BANNED_WORDS } from "../src/banned-words";
import { censorText, checkBannedWords, createChecker } from "../src/checker";

describe("checkBannedWords options", () => {
    it("restricts matching to the given languages", () => {
        expect.assertions(2);

        const all = checkBannedWords("scheisse and mierda");
        const deOnly = checkBannedWords("scheisse and mierda", { languages: ["de"] });

        const allLangs = new Set(all.matches.map((m) => m.language));

        expect(allLangs.size).toBeGreaterThanOrEqual(2);
        expect(deOnly.matches.every((m) => m.language === "de")).toBe(true);
    });

    it("treats an empty languages array as 'all languages'", () => {
        expect.assertions(1);

        const result = checkBannedWords("fuck this", { languages: [] });

        expect(result.hasBannedWords).toBe(true);
    });

    it("can restrict CJK matching by language", () => {
        expect.assertions(2);

        const zhOnly = checkBannedWords("你是傻逼", { languages: ["zh"] });
        const jaOnly = checkBannedWords("你是傻逼", { languages: ["ja"] });

        expect(zhOnly.hasBannedWords).toBe(true);
        expect(jaOnly.matches.every((m) => m.language === "ja")).toBe(true);
    });

    it("suppresses a flagged word via the allowlist", () => {
        expect.assertions(3);

        const withList = checkBannedWords("this is fuck", { allowlist: ["fuck"] });
        const without = checkBannedWords("this is fuck");

        expect(withList.hasBannedWords).toBe(false);
        expect(withList.matches).toStrictEqual([]);
        expect(without.hasBannedWords).toBe(true);
    });

    it("matches the allowlist case-insensitively", () => {
        expect.assertions(1);

        const result = checkBannedWords("this is FuCk", { allowlist: ["FUCK"] });

        expect(result.hasBannedWords).toBe(false);
    });

    it("flags extra terms supplied via customWords", () => {
        expect.assertions(3);

        const withCustom = checkBannedWords("please do not frobnicate", { customWords: ["frobnicate"] });
        const without = checkBannedWords("please do not frobnicate");

        expect(withCustom.hasBannedWords).toBe(true);
        expect(without.hasBannedWords).toBe(false);
        // the custom term is reported under the synthetic "custom" language
        expect(withCustom.matches.some((m) => m.word === "frobnicate" && m.language === "custom")).toBe(true);
    });

    it("still flags built-in words when customWords are supplied", () => {
        expect.assertions(1);

        const result = checkBannedWords("this is fuck", { customWords: ["frobnicate"] });

        expect(result.hasBannedWords).toBe(true);
    });

    it("always scans customWords even when languages is restricted", () => {
        expect.assertions(2);

        const result = checkBannedWords("please do not frobnicate", { customWords: ["frobnicate"], languages: ["en"] });

        expect(result.hasBannedWords).toBe(true);
        expect(result.matches.some((m) => m.word === "frobnicate")).toBe(true);
    });

    it("allowlist and customWords can be combined", () => {
        expect.assertions(2);

        const result = checkBannedWords("frobnicate and fuck", { allowlist: ["fuck"], customWords: ["frobnicate"] });

        expect(result.matches.some((m) => m.word === "frobnicate")).toBe(true);
        expect(result.matches.some((m) => m.word.toLowerCase() === "fuck")).toBe(false);
    });

    it("treats empty allowlist/customWords arrays as the default behaviour", () => {
        expect.assertions(2);

        const baseline = checkBannedWords("this is fuck");
        const withEmpties = checkBannedWords("this is fuck", { allowlist: [], customWords: [] });

        expect(withEmpties.hasBannedWords).toBe(baseline.hasBannedWords);
        expect(withEmpties.matches).toStrictEqual(baseline.matches);
    });
});

describe("unicode-safe match positions", () => {
    it("reports correct indices after a non-recomposable combining dot above (U+0307)", () => {
        expect.assertions(4);

        // "q" + U+0307 has no precomposed NFC form, so folding shortens the string; positions must
        // still index the original text, not the folded one.
        const text = "q̇uick fuck here";
        const result = checkBannedWords(text);
        const match = result.matches.find((m) => m.word.toLowerCase() === "fuck");

        expect(match).toBeDefined();
        expect(match!.startIndex).toBe(7);
        expect(match!.endIndex).toBe(11);
        expect(text.slice(match!.startIndex, match!.endIndex)).toBe("fuck");
    });

    it("censors the correct span after a combining dot above", () => {
        expect.assertions(1);

        expect(censorText("q̇uick fuck here")).toBe("q̇uick **** here");
    });

    it("folds Turkish dotted capital İ and reports the original span", () => {
        expect.assertions(3);

        // "İST" folds to "ist"; the reported match must keep the original 3-code-unit span.
        const result = checkBannedWords("İST here", { customWords: ["ist"] });
        const match = result.matches.find((m) => m.word === "İST");

        expect(match).toBeDefined();
        expect(match!.startIndex).toBe(0);
        expect(match!.endIndex).toBe(3);
    });
});

describe("createChecker per-call options", () => {
    it("honors per-call customWords", () => {
        expect.assertions(2);

        const checker = createChecker();

        expect(checker.check("please do not frobnicate", { customWords: ["frobnicate"] }).hasBannedWords).toBe(true);
        expect(checker.check("please do not frobnicate").hasBannedWords).toBe(false);
    });

    it("honors a per-call allowlist", () => {
        expect.assertions(2);

        const checker = createChecker();

        expect(checker.check("this is fuck", { allowlist: ["fuck"] }).hasBannedWords).toBe(false);
        expect(checker.check("this is fuck").hasBannedWords).toBe(true);
    });

    it("honors per-call options when censoring", () => {
        expect.assertions(2);

        const checker = createChecker();

        expect(checker.censor("frobnicate now", { customWords: ["frobnicate"] })).toBe("********** now");
        expect(checker.censor("this is fuck", { allowlist: ["fuck"] })).toBe("this is fuck");
    });
});

describe(censorText, () => {
    it("masks single banned words with asterisks by default", () => {
        expect.assertions(2);

        const censored = censorText("this is fuck text");

        expect(censored).toBe("this is **** text");
        expect(censored).toHaveLength("this is fuck text".length);
    });

    it("supports a custom replacement character", () => {
        expect.assertions(1);

        expect(censorText("this is fuck text", { replacement: "#" })).toBe("this is #### text");
    });

    it("returns the input unchanged when nothing matches", () => {
        expect.assertions(1);

        expect(censorText("perfectly clean text")).toBe("perfectly clean text");
    });

    it("masks the union of overlapping matches (a contained match cannot leak its container's prefix)", () => {
        expect.assertions(3);

        const text = "es un hijo de puta";
        const censored = censorText(text);

        // The whole banned phrase "hijo de puta" [6,18) must be masked, not just the contained "puta".
        expect(censored).toBe("es un ************");
        expect(censored).toHaveLength(text.length);
        expect(censored).not.toContain("hijo");
    });

    it("masks the union of partially overlapping matches", () => {
        expect.assertions(1);

        const checker = createChecker({ words: { en: ["aa bb", "bb cc"] } });

        expect(checker.censor("aa bb cc")).toBe("********");
    });

    it("masks the union of overlapping CJK matches", () => {
        expect.assertions(1);

        const checker = createChecker({ words: { zh: ["他妈", "妈的"] } });

        expect(checker.censor("他妈的")).toBe("***");
    });

    it("censors CJK substrings", () => {
        expect.assertions(2);

        const censored = censorText("你是傻逼");

        expect(censored).not.toContain("傻逼");
        expect(censored).toHaveLength("你是傻逼".length);
    });

    it("uses only the first character of a multi-char replacement", () => {
        expect.assertions(1);

        expect(censorText("this is fuck text", { replacement: "xy" })).toBe("this is xxxx text");
    });
});

describe(createChecker, () => {
    it("matches against a custom dictionary only", () => {
        expect.assertions(2);

        const checker = createChecker({ words: { en: ["frobnicate"] } });

        expect(checker.check("please do not frobnicate").hasBannedWords).toBe(true);
        // built-in words are NOT included when a custom dictionary is supplied
        expect(checker.check("this is fuck").hasBannedWords).toBe(false);
    });

    it("surfaces category and severity from tagged entries", () => {
        expect.assertions(3);

        const checker = createChecker({
            words: { en: [{ category: "spam", severity: 3, word: "frobnicate" }] },
        });

        const match = checker.check("frobnicate now").matches[0];

        expect(match).toBeDefined();
        expect(match!.category).toBe("spam");
        expect(match!.severity).toBe(3);
    });

    it("does not set category/severity for bare-string entries", () => {
        expect.assertions(2);

        const checker = createChecker({ words: { en: ["frobnicate"] } });
        const match = checker.check("frobnicate now").matches[0]!;

        expect(match.category).toBeUndefined();
        expect(match.severity).toBeUndefined();
    });

    it("respects the allowlist (Scunthorpe problem)", () => {
        expect.assertions(2);

        const withList = createChecker({ allowlist: ["fuck"] });
        const without = createChecker();

        expect(withList.check("this is fuck").hasBannedWords).toBe(false);
        expect(without.check("this is fuck").hasBannedWords).toBe(true);
    });

    it("allowlist matching is case-insensitive", () => {
        expect.assertions(1);

        const checker = createChecker({ allowlist: ["FUCK"] });

        expect(checker.check("this is FuCk").hasBannedWords).toBe(false);
    });

    it("censors using the custom dictionary", () => {
        expect.assertions(1);

        const checker = createChecker({ words: { en: ["frobnicate"] } });

        expect(checker.censor("frobnicate now")).toBe("********** now");
    });

    it("defaults to the built-in dictionary when no words are given", () => {
        expect.assertions(1);

        const checker = createChecker();

        expect(checker.check("this is fuck").hasBannedWords).toBe(true);
    });
});

describe("bANNED_WORDS immutability", () => {
    it("is frozen", () => {
        expect.assertions(1);

        expect(Object.isFrozen(BANNED_WORDS)).toBe(true);
    });

    it("throws or silently no-ops on mutation in strict mode", () => {
        expect.assertions(1);

        expect(() => {
            // @ts-expect-error -- intentionally testing runtime immutability
            BANNED_WORDS.en = [];
        }).toThrow(TypeError);
    });

    it("deeply freezes each language array", () => {
        expect.assertions(2);

        expect(Object.isFrozen(BANNED_WORDS.en)).toBe(true);
        expect(() => {
            // @ts-expect-error -- intentionally testing runtime immutability of the nested array
            BANNED_WORDS.en.push("x");
        }).toThrow(TypeError);
    });
});
