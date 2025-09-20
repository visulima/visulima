import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Strings", () => {
    it("should inspect a string", () => {
        expect.assertions(1);

        expect(inspect("abc")).toBe("'abc'");
    });

    it("should escape single quotes", () => {
        expect.assertions(1);

        expect(inspect("ab'c")).toBe(String.raw`'ab\'c'`);
    });

    it("should not escape double quotes by default", () => {
        expect.assertions(1);

        expect(inspect("ab\"c")).toBe("'ab\"c'");
    });

    it("should escape double quotes when quoteStyle is 'double'", () => {
        expect.assertions(1);

        expect(
            inspect("ab\"c", {
                quoteStyle: "double",
            }),
        ).toBe(String.raw`"ab\"c"`);
    });

    it("should escape unicode characters", () => {
        expect.assertions(1);

        expect(inspect("\u001B")).toBe(String.raw`'\u001b'`);
    });

    it("should interpolate low bytes", () => {
        expect.assertions(2);

        expect(inspect("a\r\nb")).toBe(String.raw`'a\r\nb'`);
        // eslint-disable-next-line unicorn/no-hex-escape,unicorn/escape-case
        expect(inspect("\x05! \x1f \x12")).toBe(String.raw`'\u0005! \u001f \u0012'`);
    });

    describe("maxStringLength option", () => {
        it("should truncate a long string", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 10 })).toBe("'foobarb…'");
        });

        it("should not truncate a short string", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 11 })).toBe("'foobarbaz'");
        });

        it("should truncate a long string to a minimum length", () => {
            expect.assertions(1);

            expect(inspect("foobarbaz", { maxStringLength: 3 })).toBe("'…'");
        });

        it("should truncate a string with surrogate pairs", () => {
            expect.assertions(1);

            // not '🐱🐱\ud83d…' (length 7) but '🐱🐱…' (length 6)
            expect(inspect("🐱🐱🐱", { maxStringLength: 7 })).toBe("'🐱🐱…'");
        });

        it("should truncate a string with graphemes", () => {
            expect.assertions(1);

            // partial support: valid string for unicode
            expect(inspect("👨‍👩‍👧‍👧", { maxStringLength: 5 })).toBe("'👨…'");
        });
    });
});
