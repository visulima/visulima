import { describe, expect, expectTypeOf, it } from "vitest";

import type { BannedWordMatch, BannedWordsResult } from "../src/index";
import { BANNED_WORDS, checkBannedWords } from "../src/index";

describe("public entry point", () => {
    it("re-exports checkBannedWords from the package root", () => {
        expect.assertions(2);

        const result = checkBannedWords("hello fuck world");

        expect(result.hasBannedWords).toBe(true);
        expect(result.matches.length).toBeGreaterThan(0);
    });

    it("re-exports BANNED_WORDS from the package root", () => {
        expect.assertions(2);

        expect(BANNED_WORDS).toBeDefined();
        expect(Object.keys(BANNED_WORDS).length).toBeGreaterThan(0);
    });

    it("exposes BannedWordsResult and BannedWordMatch types", () => {
        expect.assertions(1);

        const result: BannedWordsResult = checkBannedWords("clean text here");

        expectTypeOf(result).toEqualTypeOf<BannedWordsResult>();
        expectTypeOf(result.matches).toEqualTypeOf<BannedWordMatch[]>();

        expect(result.hasBannedWords).toBe(false);
    });
});
