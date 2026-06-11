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

    it("preserves length with overlapping matches (longest wins)", () => {
        expect.assertions(1);

        const text = "es un hijo de puta";
        const censored = censorText(text);

        expect(censored).toHaveLength(text.length);
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
});
