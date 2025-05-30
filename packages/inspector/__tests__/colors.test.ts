import type { ColorizeType } from "@visulima/colorize";
import { bold, cyan, green, grey, magenta, red, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { inspect } from "../src";
import type { Options } from "../src/types";
import h from "./utils/h";

const stylize: Options["stylize"] = <S extends string>(
    value: S,

    styleType: string | "bigint" | "boolean" | "date" | "null" | "number" | "regexp" | "special" | "string" | "symbol" | "undefined",
): string => {
    const mapped = {
        bigint: yellow,
        boolean: yellow,
        date: magenta,
        null: bold,
        number: yellow,
        regexp: red,
        special: cyan,
        string: green,
        symbol: green,
        undefined: grey,
    };

    return (mapped[styleType] as ColorizeType)(value);
};

describe.runIf(globalThis.window === undefined)("colors", () => {
    it("should return a date colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(new Date(1_475_318_637_123), { colors: true, stylize })).toBe("\u001B[35m2016-10-01T10:43:57.123Z\u001B[39m");
    });

    it("should return a null colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(null, { colors: true, stylize })).toBe("\u001B[1mnull\u001B[22m");
    });

    it("should return a regex colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(/abc/, { colors: true, stylize })).toBe("\u001B[31m/abc/\u001B[39m");
    });

    it("should return a undefined colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(undefined, { colors: true, stylize })).toBe("\u001B[90mundefined\u001B[39m");
    });

    it("should return a bigint colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(1n, { colors: true, stylize })).toBe("\u001B[33m1n\u001B[39m");
    });

    it("should return a string colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect("abc", { colors: true, stylize })).toBe("\u001B[32m'abc'\u001B[39m");
    });

    it("should return a number colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(3.141, { colors: true, stylize })).toBe("\u001B[33m3.141\u001B[39m");
    });

    it("should return a boolean colorized if color is set to true", () => {
        expect.assertions(2);

        expect(inspect(false, { colors: true, stylize })).toBe("\u001B[33mfalse\u001B[39m");
        expect(inspect(true, { colors: true, stylize })).toBe("\u001B[33mtrue\u001B[39m");
    });

    it("should return a Nan colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(Number.NaN, { colors: true, stylize })).toBe("\u001B[33mNaN\u001B[39m");
    });

    it("should return a function colorized if color is set to true", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback */
        expect(inspect(function foo() {}, { colors: true, stylize })).toBe("\u001B[36m[Function: function foo() {\u001B[39m\n\u001B[36m    }]\u001B[39m");
    });

    it("should return a POSITIVE_INFINITY colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(Number.POSITIVE_INFINITY, { colors: true, stylize })).toBe("\u001B[33mInfinity\u001B[39m");
    });

    it("should return a NEGATIVE_INFINITY colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(Number.NEGATIVE_INFINITY, { colors: true, stylize })).toBe("\u001B[33m-Infinity\u001B[39m");
    });

    // TODO: Fix this test
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip("returns element as cyan, with attribute names in yellow and values as string colour", () => {
        expect.assertions(1);

        expect(inspect(h("div", { id: "foo" }), { colors: true, stylize })).toBe(
            // eslint-disable-next-line no-useless-concat
            "\u001B[36m<div\u001B[39m \u001B[33mid\u001B[39m=\u001B[32m" + "\"foo\"\u001B[39m\u001B[36m>\u001B[39m\u001B[36m</div>\u001B[39m",
        );
    });
});
