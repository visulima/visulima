import type { ColorizeType } from "@visulima/colorize";
import { bold, cyan, green, grey, magenta, red, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { inspect } from "../src";
import type { Options } from "../src/types";
import h from "./utils/h";

const stylize: Options["stylize"] = (
    value: string,

    styleType: string,
): string => {
    const mapped: Record<string, ColorizeType> = {
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

describe.runIf(!("window" in globalThis))("colors", () => {
    it("should return a date colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(new Date(1_475_318_637_123), { stylize })).toBe("\u001B[35m2016-10-01T10:43:57.123Z\u001B[39m");
    });

    it("should return a null colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(null, { stylize })).toBe("\u001B[1mnull\u001B[22m");
    });

    it("should return a regex colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(/abc/, { stylize })).toBe("\u001B[31m/abc/\u001B[39m");
    });

    it("should return a undefined colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(undefined, { stylize })).toBe("\u001B[90mundefined\u001B[39m");
    });

    it("should return a bigint colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(1n, { stylize })).toBe("\u001B[33m1n\u001B[39m");
    });

    it("should return a string colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect("abc", { stylize })).toBe("\u001B[32m'abc'\u001B[39m");
    });

    it("should return a number colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(3.141, { stylize })).toBe("\u001B[33m3.141\u001B[39m");
    });

    it("should return a boolean colorized if color is set to true", () => {
        expect.assertions(2);

        expect(inspect(false, { stylize })).toBe("\u001B[33mfalse\u001B[39m");
        expect(inspect(true, { stylize })).toBe("\u001B[33mtrue\u001B[39m");
    });

    it("should return a Nan colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(Number.NaN, { stylize })).toBe("\u001B[33mNaN\u001B[39m");
    });

    it("should return a function colorized if color is set to true", () => {
        expect.assertions(1);

        const functionString = function foo() {}.toString();

        expect(inspect(function foo() {}, { stylize })).toBe(`\u001B[36m[Function: ${functionString}]\u001B[39m`);
    });

    it("should return a POSITIVE_INFINITY colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(Number.POSITIVE_INFINITY, { stylize })).toBe("\u001B[33mInfinity\u001B[39m");
    });

    it("should return a NEGATIVE_INFINITY colorized if color is set to true", () => {
        expect.assertions(1);

        expect(inspect(Number.NEGATIVE_INFINITY, { stylize })).toBe("\u001B[33m-Infinity\u001B[39m");
    });

    // TODO: Fix this test
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip("returns element as cyan, with attribute names in yellow and values as string colour", () => {
        expect.assertions(1);

        expect(inspect(h("div", { id: "foo" }), { stylize })).toBe(
            // eslint-disable-next-line no-useless-concat
            "\u001B[36m<div\u001B[39m \u001B[33mid\u001B[39m=\u001B[32m" + "\"foo\"\u001B[39m\u001B[36m>\u001B[39m\u001B[36m</div>\u001B[39m",
        );
    });
});
