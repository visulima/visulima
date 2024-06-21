import { black, green } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import slice from "../src/slice";

describe(`slice`, () => {
    it(`should slice empty strings just fine`, () => {
        expect.assertions(1);

        expect(slice(``)).toStrictEqual({ slice: ``, visible: 0 });
    });

    it(`should slice regular strings just fine`, () => {
        expect.assertions(1);

        expect(slice(`foo`)).toStrictEqual({ slice: `foo`, visible: 3 });
    });

    it(`should slice strings with parameters just fine`, () => {
        expect.assertions(1);

        expect(slice(`foobar`, 1, 3)).toStrictEqual({ slice: `oo`, visible: 2 });
    });

    it(`shouldn't care if the slice goes beyond the string length`, () => {
        expect.assertions(1);

        expect(slice(`foobar`, 0, 100)).toStrictEqual({ slice: `foobar`, visible: 6 });
    });

    it(`should preserve escape codes preceding the slice`, () => {
        expect.assertions(1);

        expect(slice(`\u001B[3mfoobar`, 1)).toStrictEqual({ slice: `\u001B[3moobar`, visible: 5 });
    });

    it(`should preserve escape codes following the slice`, () => {
        expect.assertions(1);

        expect(slice(`foobar\u001B[3m`, 0, 5)).toStrictEqual({ slice: `fooba\u001B[3m`, visible: 5 });
    });

    it(`should preserve escape codes inside a slice`, () => {
        expect.assertions(1);

        expect(slice(`hello wo\u001B[3mrld f\u001B[6moo bar`, 1, 18)).toStrictEqual({ slice: `ello wo\u001B[3mrld f\u001B[6moo ba`, visible: 17 });
    });

    it(`should slice across hyperlinks`, () => {
        expect.assertions(2);

        expect(slice(`foo\u001B]8;;https://example.org\u001B\\bar\u001B]8;;\u001B\\baz`, 1, 8)).toStrictEqual({
            slice: `oo\u001B]8;;https://example.org\u001B\\bar\u001B]8;;\u001B\\ba`,
            visible: 7,
        });

        expect(slice(`foo\u001B]8;;https://example.org\u0007bar\u001B]8;;\u0007baz`, 1, 8)).toStrictEqual({
            slice: `oo\u001B]8;;https://example.org\u0007bar\u001B]8;;\u0007ba`,
            visible: 7,
        });
    });

    it(`should remove mode change escape codes`, () => {
        expect.assertions(1);

        expect(slice(`\u001B[?2004hfoo`, 0, 3)).toStrictEqual({ slice: `foo`, visible: 3 });
    });

    it(`should work with a variety of complexish cases`, () => {
        expect.assertions(1);

        expect(slice(`\u001B[93m➤\u001B[39m foo`, 0, 5)).toStrictEqual({ slice: `\u001B[93m➤\u001B[39m foo`, visible: 5 });
    });

    it("supports fullwidth characters", () => {
        expect.assertions(1);

        expect(slice("안녕하세", 0, 4)).toBe({
            slice: "안녕",
            visible: 4,
        });
    });

    it("supports unicode surrogate pairs", () => {
        expect.assertions(1);

        expect(slice("a\uD83C\uDE00BC", 0, 2).slice).toBe("a\uD83C\uDE00");
    });

    it("doesn't add unnecessary escape codes", () => {
        expect.assertions(1);

        expect(slice("\u001B[31municorn\u001B[39m", 0, 3).slice).toBe("\u001B[31muni\u001B[39m");
    });

    it("should slice a normal character before a colored character", () => {
        expect.assertions(1);

        expect(slice("a\u001B[31mb\u001B[39m", 0, 1).slice).toBe("a");
    });

    it("should slice a normal character after a colored character", () => {
        expect.assertions(1);

        expect(slice("\u001B[31ma\u001B[39mb", 1, 2).slice).toBe("b");
    });

    // See https://github.com/chalk/slice-ansi/issues/22
    it("should slice a string styled with both background and foreground", () => {
        expect.assertions(1);

        // Test string: `chalk.bgGreen.black('test');`
        expect(slice("\u001B[42m\u001B[30mtest\u001B[39m\u001B[49m", 0, 1).slice).toBe("\u001B[42m\u001B[30mt\u001B[39m\u001B[49m");
    });

    it("should slice a string styled with modifier", () => {
        expect.assertions(1);

        // Test string: `chalk.underline('test');`
        expect(slice("\u001B[4mtest\u001B[24m", 0, 1).slice).toBe("\u001B[4mt\u001B[24m");
    });

    it("should slice a string with unknown ANSI color", () => {
        expect.assertions(3);

        expect(slice("\u001B[20mTEST\u001B[49m", 0, 4).slice).toBe("\u001B[20mTEST\u001B[0m");
        expect(slice("\u001B[1001mTEST\u001B[49m", 0, 3).slice).toBe("\u001B[1001mTES\u001B[0m");
        expect(slice("\u001B[1001mTEST\u001B[49m", 0, 2).slice).toBe("\u001B[1001mTE\u001B[0m");
    });

    it("weird null issue", () => {
        expect.assertions(1);

        const s = '\u001B[1mautotune.flipCoin("easy as") ? 🎂 : 🍰 \u001B[33m★\u001B[39m\u001B[22m';
        const result = slice(s, 38).slice;

        expect(result.includes("null")).toBeFalsy();
    });

    it("should support true color escape sequences", () => {
        expect.assertions(1);

        expect(slice("\u001B[1m\u001B[48;2;255;255;255m\u001B[38;2;255;0;0municorn\u001B[39m\u001B[49m\u001B[22m", 0, 3).slice).toBe(
            "\u001B[1m\u001B[48;2;255;255;255m\u001B[38;2;255;0;0muni\u001B[39m\u001B[49m\u001B[22m",
        );
    });

    // See https://github.com/chalk/slice-ansi/issues/24
    it("shouldn't add extra escapes", () => {
        expect.assertions(1);

        const output = `${black.bgYellow(" RUNS ")}  ${green("test")}`;

        expect(slice(output, 0, 7).slice).toBe(`${black.bgYellow(" RUNS ")} `);
        expect(slice(output, 0, 8).slice).toBe(`${black.bgYellow(" RUNS ")}  `);
        expect(JSON.stringify(slice("\u001B[31m" + output, 0, 4).slice)).toBe(JSON.stringify(black.bgYellow(" RUN")));
    });

    // See https://github.com/chalk/slice-ansi/issues/26
    it("shouldn't lose fullwidth characters", () => {
        expect.assertions(1);

        expect(slice("古古test", 0).slice).toBe("古古test");
    });

    it("should create empty slices", () => {
        expect.assertions(1);

        expect(slice("test", 0, 0).slice).toBe("");
    });
});
