import { describe, expect, it } from "vitest";

import preserveAnsi from "../../../src/utils/ansi-preserve";

describe("preserveAnsi", () => {
    describe("basic functionality", () => {
        it("should handle empty array", () => {
            expect.assertions(1);

            expect(preserveAnsi([])).toBe("");
        });

        it("should handle single line without ANSI codes", () => {
            expect.assertions(1);

            expect(preserveAnsi(["Hello World"])).toBe("Hello World");
        });

        it("should handle multiple lines without ANSI codes", () => {
            expect.assertions(1);

            expect(preserveAnsi(["Hello", "World"])).toBe("Hello\nWorld");
        });
    });

    describe("aNSI color code preservation", () => {
        it("should preserve basic color codes across line breaks", () => {
            expect.assertions(1);

            expect(preserveAnsi(["\u001B[31mRed", "Text\u001B[0m"])).toBe("\u001B[31mRed\u001B[39m\n\u001B[31mText\u001B[0m");
        });

        it("should handle multiple color codes", () => {
            expect.assertions(1);

            expect(preserveAnsi(["\u001B[31m\u001B[42mColored", "Text\u001B[0m"])).toMatchInlineSnapshot(`
              "\u001B[31m\u001B[42mColored\u001B[49m
              \u001B[42mText\u001B[0m"
            `);
        });

        it("should handle nested color codes", () => {
            expect.assertions(1);

            const input = ["\u001B[31mRed \u001B[34mBlue", "Still Blue\u001B[31m Red Again\u001B[0m"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31mRed \u001B[34mBlue\u001B[39m
              \u001B[34mStill Blue\u001B[31m Red Again\u001B[0m"
            `);
        });
    });

    describe("hyperlink handling", () => {
        it("should preserve hyperlinks across line breaks", () => {
            expect.assertions(1);

            const input = ["\u001B]8;;https://example.com\u0007Link", "Continues\u001B]8;;\u0007"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B]8;;https://example.com\u0007Link\u001B]8;;\u0007
              \u001B]8;;https://example.com\u0007Continues\u001B]8;;\u0007"
            `);
        });

        it("should handle hyperlinks with color codes", () => {
            expect.assertions(1);

            const input = ["\u001B[31m\u001B]8;;https://example.com\u0007Colored", "Link\u001B]8;;\u0007\u001B[0m"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31m\u001B]8;;https://example.com\u0007Colored\u001B]8;;\u0007\u001B[39m
              \u001B[31m\u001B]8;;https://example.com\u0007Link\u001B]8;;\u0007\u001B[0m"
            `);
        });
    });

    describe("edge cases", () => {
        it("should handle empty lines", () => {
            expect.assertions(1);

            const input = ["\u001B[31mRed", "", "Still Red\u001B[0m"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31mRed\u001B[39m
              \u001B[39m
              \u001B[31mStill Red\u001B[0m"
            `);
        });

        it("should handle lines with only ANSI codes", () => {
            expect.assertions(1);

            const input = ["\u001B[31m", "\u001B[42m", "\u001B[0m"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31m\u001B[39m
              \u001B[31m\u001B[42m\u001B[49m
              \u001B[42m\u001B[0m"
            `);
        });

        it("should handle multiple consecutive ANSI codes", () => {
            expect.assertions(1);

            const input = ["\u001B[31m\u001B[1m\u001B[42mText", "More\u001B[0m"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31m\u001B[1m\u001B[42mText\u001B[49m
              \u001B[42mMore\u001B[0m"
            `);
        });

        it("should handle incomplete ANSI sequences", () => {
            expect.assertions(1);

            const input = ["\u001B[31mText\u001B[", "More Text\u001B[0m"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31mText\u001B[
              More Text\u001B[0m"
            `);
        });
    });

    describe("reset code handling", () => {
        it("should properly reset foreground colors", () => {
            expect.assertions(1);

            const input = ["\u001B[31mRed Text\u001B[39m", "Normal Text"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31mRed Text\u001B[39m
              Normal Text"
            `);
        });

        it("should properly reset background colors", () => {
            expect.assertions(1);

            const input = ["\u001B[42mGreen BG\u001B[49m", "Normal BG"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[42mGreen BG\u001B[49m
              Normal BG"
            `);
        });

        it("should handle multiple reset codes", () => {
            expect.assertions(1);

            const input = ["\u001B[31m\u001B[42mColored\u001B[39m\u001B[49m", "Normal"];

            expect(preserveAnsi(input)).toMatchInlineSnapshot(`
              "\u001B[31m\u001B[42mColored\u001B[39m\u001B[49m
              Normal"
            `);
        });
    });
});
