import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("strings", () => {
    it("returns string wrapped in quotes", () => {
        expect.assertions(1);

        expect(inspect("abc")).toBe("'abc'");
    });

    it("escapes single quotes", () => {
        expect.assertions(1);

        expect(inspect("ab'c")).toBe(String.raw`'ab\'c'`);
    });

    it("does not escape double quotes", () => {
        expect.assertions(2);

        expect(inspect("ab\"c")).toBe("'ab\"c'");
        expect(
            inspect("ab\"c", {
                quoteStyle: "double",
            }),
        ).toBe("\"ab\"c\"");
    });

    it("escapes unicode characters", () => {
        expect.assertions(1);

        expect(inspect("\u001B")).toBe(String.raw`'\u001b'`);
    });

    it("should interpolate low bytes", () => {
        expect.assertions(2);

        expect(inspect("a\r\nb")).toBe(String.raw`'a\r\nb'`);
        // eslint-disable-next-line unicorn/no-hex-escape,unicorn/escape-case
        expect(inspect("\x05! \x1f \x12")).toBe(String.raw`'\u0005! \u001f \u0012'`);
    });

    describe("maxStringLength", () => {
        it("returns the full string representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 11 })).toBe("'foobarbaz'");
        });

        it("maxStringLengths strings longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 10 })).toBe("'foobarb…'");
        });

        it("maxStringLengths strings longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 9 })).toBe("'foobar…'");
        });

        it("maxStringLengths strings longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 8 })).toBe("'fooba…'");
        });

        it("maxStringLengths strings longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 7 })).toBe("'foob…'");
        });

        it("maxStringLengths strings longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 6 })).toBe("'foo…'");
        });

        it("maxStringLengths strings longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 5 })).toBe("'fo…'");
        });

        it("maxStringLengths strings longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 4 })).toBe("'f…'");
        });

        it("maxStringLengths strings longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 3 })).toBe("'…'");
        });

        it("maxStringLengths strings involving surrogate pairs longer than maxStringLength (7)", () => {
            expect.assertions(1);

            // not '🐱🐱\ud83d…' (length 7) but '🐱🐱…' (length 6)
            expect(inspect("🐱🐱🐱", { maxStringLength: 7 })).toBe("'🐱🐱…'");
        });

        it("maxStringLengths strings involving surrogate pairs longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect("🐱🐱🐱", { maxStringLength: 6 })).toBe("'🐱…'");
        });

        it("maxStringLengths strings involving surrogate pairs longer than maxStringLength (5)", () => {
            expect.assertions(1);

            // not '🐱\ud83d…' (length 5) but '🐱…' (length 4)
            expect(inspect("🐱🐱🐱", { maxStringLength: 5 })).toBe("'🐱…'");
        });

        it("maxStringLengths strings involving graphemes than maxStringLength (5)", () => {
            expect.assertions(1);

            // partial support: valid string for unicode
            expect(inspect("👨‍👩‍👧‍👧", { maxStringLength: 5 })).toBe("'👨…'");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (2)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 2 })).toBe("'…'");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (1)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 1 })).toBe("'…'");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (0)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 0 })).toBe("'…'");
        });
    });
});
