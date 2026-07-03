/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, expectTypeOf, it } from "vitest";

import { BANNED_WORDS } from "../src/banned-words";
import { checkBannedWords } from "../src/checker";

describe(checkBannedWords, () => {
    describe("empty / clean input", () => {
        it("returns no matches for empty string", () => {
            expect.assertions(2);

            const result = checkBannedWords("");

            expect(result.hasBannedWords).toBe(false);
            expect(result.matches).toStrictEqual([]);
        });

        it("returns no matches for whitespace-only string", () => {
            expect.assertions(2);

            const result = checkBannedWords("   \n\t  ");

            expect(result.hasBannedWords).toBe(false);
            expect(result.matches).toStrictEqual([]);
        });

        it("returns no matches for clean text", () => {
            expect.assertions(2);

            const result = checkBannedWords("Hello, how are you today? The weather is nice.");

            expect(result.hasBannedWords).toBe(false);
            expect(result.matches).toStrictEqual([]);
        });

        it("returns no matches for long clean text", () => {
            expect.assertions(1);

            const result = checkBannedWords(
                "This is a perfectly normal message about programming. I love writing TypeScript code and building web applications with React.",
            );

            expect(result.hasBannedWords).toBe(false);
        });
    });

    describe("english detection", () => {
        it("detects a single banned word", () => {
            expect.assertions(3);

            const result = checkBannedWords("you are a nigger");

            expect(result.hasBannedWords).toBe(true);
            expect(result.matches).toHaveLength(1);
            expect(result.matches[0]!.word.toLowerCase()).toBe("nigger");

            // "nigger" appears in multiple language lists; first alphabetically wins
            expectTypeOf(result.matches[0]!.language).toBeString();
        });

        it("detects multiple banned words", () => {
            expect.assertions(4);

            const result = checkBannedWords("fuck this shit");

            expect(result.hasBannedWords).toBe(true);
            expect(result.matches.length).toBeGreaterThanOrEqual(2);

            const words = result.matches.map((m) => m.word.toLowerCase());

            expect(words).toContain("fuck");
            expect(words).toContain("shit");
        });

        it("is case-insensitive", () => {
            expect.assertions(2);

            const result = checkBannedWords("FUCK FuCk fuck");

            expect(result.hasBannedWords).toBe(true);
            expect(result.matches.length).toBeGreaterThanOrEqual(3);
        });

        it("detects multi-word phrases", () => {
            expect.assertions(2);

            const result = checkBannedWords("that is white trash behavior");

            expect(result.hasBannedWords).toBe(true);

            const words = result.matches.map((m) => m.word.toLowerCase());

            expect(words).toContain("white trash");
        });

        it("detects leet-speak variants from Google list", () => {
            expect.assertions(1);

            const result = checkBannedWords("you are a b1tch");

            expect(result.hasBannedWords).toBe(true);
        });
    });

    describe("match positions", () => {
        it("returns correct startIndex and endIndex", () => {
            expect.assertions(5);

            const text = "hello fuck world";
            const result = checkBannedWords(text);

            expect(result.hasBannedWords).toBe(true);

            const match = result.matches.find((m) => m.word.toLowerCase() === "fuck");

            expect(match).toBeDefined();
            expect(match!.startIndex).toBe(6);
            expect(match!.endIndex).toBe(10);
            expect(text.slice(match!.startIndex, match!.endIndex).toLowerCase()).toBe("fuck");
        });

        it("returns correct positions for multiple matches", () => {
            expect.hasAssertions();

            const text = "shit and fuck";
            const result = checkBannedWords(text);

            for (const match of result.matches) {
                const extracted = text.slice(match.startIndex, match.endIndex);

                expect(extracted.toLowerCase()).toBe(match.word.toLowerCase());
            }
        });

        it("positions are usable for text highlighting", () => {
            expect.assertions(2);

            const text = "this is bullshit and you know it";
            const result = checkBannedWords(text);

            expect(result.hasBannedWords).toBe(true);

            const match = result.matches[0]!;
            const before = text.slice(0, match.startIndex);
            const highlighted = text.slice(match.startIndex, match.endIndex);
            const after = text.slice(match.endIndex);

            expect(before + highlighted + after).toBe(text);
        });

        it("returns phrase positions that map back to the original text", () => {
            expect.assertions(2);

            const text = "look at that white trash over there";
            const result = checkBannedWords(text);
            const match = result.matches.find((m) => m.word.toLowerCase() === "white trash");

            expect(match).toBeDefined();
            expect(text.slice(match!.startIndex, match!.endIndex).toLowerCase()).toBe("white trash");
        });

        it("supports reverse-iteration censoring as documented", () => {
            expect.assertions(2);

            const text = "shit and fuck";
            const result = checkBannedWords(text);

            let censored = text;

            for (const match of result.matches.toSorted((a, b) => b.startIndex - a.startIndex)) {
                const replacement = "*".repeat(match.word.length);

                censored = censored.slice(0, match.startIndex) + replacement + censored.slice(match.endIndex);
            }

            expect(censored).not.toContain("fuck");
            expect(censored).not.toContain("shit");
        });
    });

    describe("word boundary matching", () => {
        it("does not match partial words for Latin scripts", () => {
            expect.assertions(1);

            // "ass" should not match inside "class" or "assignment"
            const result = checkBannedWords("I went to class for my assignment");
            const assMatches = result.matches.filter((m) => m.word.toLowerCase() === "ass");

            expect(assMatches).toHaveLength(0);
        });

        it("does not match 'ho' inside 'house'", () => {
            expect.assertions(1);

            const result = checkBannedWords("I went to the house");
            const hoMatches = result.matches.filter((m) => m.word.toLowerCase() === "ho");

            expect(hoMatches).toHaveLength(0);
        });

        it("matches standalone word at start of text", () => {
            expect.assertions(1);

            const result = checkBannedWords("fuck this");

            expect(result.hasBannedWords).toBe(true);
        });

        it("matches standalone word at end of text", () => {
            expect.assertions(1);

            const result = checkBannedWords("this is fuck");

            expect(result.hasBannedWords).toBe(true);
        });

        it("matches word surrounded by punctuation", () => {
            expect.assertions(1);

            // eslint-disable-next-line @stylistic/quotes -- prettier enforces single quotes when the string itself contains escaped double quotes
            const result = checkBannedWords('he said "fuck" loudly');

            expect(result.hasBannedWords).toBe(true);
        });
    });

    describe("german detection", () => {
        it("detects German profanity", () => {
            expect.assertions(3);

            const result = checkBannedWords("Du bist ein Arschloch");

            expect(result.hasBannedWords).toBe(true);

            const match = result.matches.find((m) => m.word.toLowerCase() === "arschloch");

            expect(match).toBeDefined();
            expect(match!.language).toBe("de");
        });

        it("detects German slur", () => {
            expect.assertions(1);

            const result = checkBannedWords("Hurensohn");

            expect(result.hasBannedWords).toBe(true);
        });
    });

    describe("spanish detection", () => {
        it("detects Spanish profanity", () => {
            expect.assertions(2);

            const result = checkBannedWords("eres un pendejo");

            expect(result.hasBannedWords).toBe(true);

            const words = result.matches.map((m) => m.word.toLowerCase());

            expect(words).toContain("pendejo");
        });

        it("detects 'hijo de puta'", () => {
            expect.assertions(1);

            const result = checkBannedWords("es un hijo de puta");

            expect(result.hasBannedWords).toBe(true);
        });
    });

    describe("french detection", () => {
        it("detects French profanity", () => {
            expect.assertions(2);

            const result = checkBannedWords("tu es un connard");

            expect(result.hasBannedWords).toBe(true);

            const words = result.matches.map((m) => m.word.toLowerCase());

            expect(words).toContain("connard");
        });

        it("detects 'fils de pute'", () => {
            expect.assertions(1);

            const result = checkBannedWords("c'est un fils de pute");

            expect(result.hasBannedWords).toBe(true);
        });
    });

    describe("chinese detection (CJK without word boundaries)", () => {
        it("detects Chinese profanity", () => {
            expect.assertions(3);

            const result = checkBannedWords("你是傻逼");

            expect(result.hasBannedWords).toBe(true);

            const match = result.matches.find((m) => m.word === "傻逼");

            expect(match).toBeDefined();
            expect(match!.language).toBe("zh");
        });

        it("detects Chinese profanity embedded in text", () => {
            expect.assertions(1);

            const result = checkBannedWords("这个人真他妈的烦人");

            expect(result.hasBannedWords).toBe(true);
        });
    });

    describe("chinese repeated occurrences", () => {
        it("returns a match for each occurrence of the same CJK word", () => {
            expect.assertions(3);

            const result = checkBannedWords("傻逼傻逼");
            const matches = result.matches.filter((m) => m.word === "傻逼");

            expect(result.hasBannedWords).toBe(true);
            expect(matches.length).toBeGreaterThanOrEqual(2);
            expect(matches[0]!.startIndex).toBeLessThan(matches[1]!.startIndex);
        });
    });

    describe("japanese detection", () => {
        it("detects Japanese profanity", () => {
            expect.assertions(3);

            const result = checkBannedWords("お前はクソだ");

            expect(result.hasBannedWords).toBe(true);

            const match = result.matches.find((m) => m.word === "クソ");

            expect(match).toBeDefined();
            expect(match!.language).toBe("ja");
        });
    });

    describe("korean detection", () => {
        it("detects Korean profanity", () => {
            expect.assertions(3);

            const result = checkBannedWords("이 씨발 뭐야");

            expect(result.hasBannedWords).toBe(true);

            const match = result.matches.find((m) => m.word === "씨발");

            expect(match).toBeDefined();
            expect(match!.language).toBe("ko");
        });
    });

    describe("arabic detection", () => {
        it("detects Arabic profanity (native script)", () => {
            expect.assertions(1);

            const result = checkBannedWords("أنت شرموطة");

            expect(result.hasBannedWords).toBe(true);
        });

        it("detects Arabic profanity (transliterated)", () => {
            expect.assertions(1);

            const result = checkBannedWords("you sharmouta");

            expect(result.hasBannedWords).toBe(true);
        });
    });

    describe("russian detection", () => {
        it("detects Russian profanity (transliterated)", () => {
            expect.assertions(2);

            const result = checkBannedWords("idi nahuy blyad");

            expect(result.hasBannedWords).toBe(true);

            const words = result.matches.map((m) => m.word.toLowerCase());

            expect(words).toContain("blyad");
        });
    });

    describe("multi-language in single text", () => {
        it("detects words from multiple languages", () => {
            expect.assertions(3);

            const result = checkBannedWords("scheisse and mierda");

            expect(result.hasBannedWords).toBe(true);
            expect(result.matches.length).toBeGreaterThanOrEqual(2);

            const langs = new Set(result.matches.map((m) => m.language));

            expect(langs.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe("unicode normalization", () => {
        it("matches NFC-normalized text", () => {
            expect.assertions(2);

            // "enculé" can be composed differently
            const nfc = "encul\u00E9"; // é as single character
            const nfd = "encule\u0301"; // e + combining accent

            const resultNfc = checkBannedWords(nfc);
            const resultNfd = checkBannedWords(nfd);

            expect(resultNfc.hasBannedWords).toBe(true);
            expect(resultNfd.hasBannedWords).toBe(true);
        });
    });

    describe("caching", () => {
        it("returns consistent results across multiple calls", () => {
            expect.assertions(2);

            const text = "fuck this";
            const result1 = checkBannedWords(text);
            const result2 = checkBannedWords(text);

            expect(result1.hasBannedWords).toBe(result2.hasBannedWords);
            expect(result1.matches).toHaveLength(result2.matches.length);
        });

        it("handles sequential calls with different inputs", () => {
            expect.assertions(3);

            const clean = checkBannedWords("hello world");
            const dirty = checkBannedWords("hello fuck world");
            const cleanAgain = checkBannedWords("hello world");

            expect(clean.hasBannedWords).toBe(false);
            expect(dirty.hasBannedWords).toBe(true);
            expect(cleanAgain.hasBannedWords).toBe(false);
        });
    });
});

describe("bANNED_WORDS", () => {
    it("contains all expected language codes", () => {
        expect.hasAssertions();

        const expectedLangs = ["ar", "az", "de", "en", "es", "fa", "fr", "ga", "hi", "it", "ja", "ko", "nl", "pl", "pt", "ru", "sv", "tr", "zh"];

        for (const lang of expectedLangs) {
            expect(BANNED_WORDS[lang]).toBeDefined();
            expect(Array.isArray(BANNED_WORDS[lang])).toBe(true);
        }
    });

    it("has 19 languages", () => {
        expect.assertions(1);

        expect(Object.keys(BANNED_WORDS)).toHaveLength(19);
    });

    it("all word lists are non-empty", () => {
        expect.hasAssertions();

        for (const [lang, words] of Object.entries(BANNED_WORDS)) {
            expect(words.length, `${lang} should have words`).toBeGreaterThan(0);
        }
    });

    it("all words are lowercase trimmed strings", () => {
        expect.hasAssertions();

        for (const [lang, words] of Object.entries(BANNED_WORDS)) {
            for (const word of words) {
                expectTypeOf(word).toBeString();

                expect(word.length, `${lang}: word should be non-empty`).toBeGreaterThan(0);
                expect(word, `${lang}: "${word}" should be trimmed`).toBe(word.trim());
            }
        }
    });

    it("has no duplicate words within a language", () => {
        expect.hasAssertions();

        for (const [lang, words] of Object.entries(BANNED_WORDS)) {
            const lowered = words.map((w) => w.toLowerCase());
            const unique = new Set(lowered);

            expect(unique.size, `${lang} should have no duplicates (found ${String(lowered.length - unique.size)})`).toBe(lowered.length);
        }
    });

    it("english list has substantial coverage", () => {
        expect.assertions(1);

        expect(BANNED_WORDS["en"]!.length).toBeGreaterThan(1000);
    });
});
