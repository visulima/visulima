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

    describe("truncate", () => {
        it("returns the full string representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 11 })).toBe("'foobarbaz'");
        });

        it("truncates strings longer than truncate (10)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 10 })).toBe("'foobarb…'");
        });

        it("truncates strings longer than truncate (9)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 9 })).toBe("'foobar…'");
        });

        it("truncates strings longer than truncate (8)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 8 })).toBe("'fooba…'");
        });

        it("truncates strings longer than truncate (7)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 7 })).toBe("'foob…'");
        });

        it("truncates strings longer than truncate (6)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 6 })).toBe("'foo…'");
        });

        it("truncates strings longer than truncate (5)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 5 })).toBe("'fo…'");
        });

        it("truncates strings longer than truncate (4)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 4 })).toBe("'f…'");
        });

        it("truncates strings longer than truncate (3)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 3 })).toBe("'…'");
        });

        it("truncates strings involving surrogate pairs longer than truncate (7)", () => {
            expect.assertions(1);

            // not '🐱🐱\ud83d…' (length 7) but '🐱🐱…' (length 6)
            expect(inspect("🐱🐱🐱", { truncate: 7 })).toBe("'🐱🐱…'");
        });

        it("truncates strings involving surrogate pairs longer than truncate (6)", () => {
            expect.assertions(1);

            expect(inspect("🐱🐱🐱", { truncate: 6 })).toBe("'🐱…'");
        });

        it("truncates strings involving surrogate pairs longer than truncate (5)", () => {
            expect.assertions(1);

            // not '🐱\ud83d…' (length 5) but '🐱…' (length 4)
            expect(inspect("🐱🐱🐱", { truncate: 5 })).toBe("'🐱…'");
        });

        it("truncates strings involving graphemes than truncate (5)", () => {
            expect.assertions(1);

            // partial support: valid string for unicode
            expect(inspect("👨‍👩‍👧‍👧", { truncate: 5 })).toBe("'👨…'");
        });

        it("disregards truncate when it cannot truncate further (2)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 2 })).toBe("'…'");
        });

        it("disregards truncate when it cannot truncate further (1)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 1 })).toBe("'…'");
        });

        it("disregards truncate when it cannot truncate further (0)", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { truncate: 0 })).toBe("'…'");
        });
    });
});
