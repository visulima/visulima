import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

describe("usage `@visulima/colorize` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename, ["--color"]);

        const expected =
            `[Function: self] Object {
  strip: \x1b[36m[Function (anonymous)]\x1b[39m,
  Colorize: \x1b[36m[Function: Colorize]\x1b[39m
}\n` +
            "\u001B[93m\u001B[7m -= [colorize package] CommonJS =- \u001B[27m\u001B[39m\n" +
            "\u001B[31m\u001B[1m\u001B[4mred.bold.underline('red')\u001B[24m\u001B[22m\u001B[39m\n" +
            "\u001B[31m\u001B[1m\u001B[4mcolorize.red.bold.underline(red)\u001B[24m\u001B[22m\u001B[39m\n" +
            "\u001B[93m\u001B[1mhex('#FFAB40').bold('#63ffc6')\u001B[22m\u001B[39m\n" +
            "\u001B[93m\u001B[1mcolorize.hex('#FFAB40').bold(#63ffc6)\u001B[22m\u001B[39m\n" +
            "\u001B[1m\u001B[31mcolorize2.bold.red\u001B[39m\u001B[22m\n" +
            "colored:  \u001B[32mgreen text\u001B[39m\n" +
            "striped:  green text";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename, ["--color"]);

        const expected =
            "[Function: self] Object { strip: \x1b[36m[Function (anonymous)]\x1b[39m }\n" +
            "\u001B[91m\u001B[7m -= [colorize package] ESM =- \u001B[27m\u001B[39m\n" +
            "\u001B[31m\u001B[1m\u001B[4mred.bold.underline('red')\u001B[24m\u001B[22m\u001B[39m\n" +
            "\u001B[31m\u001B[1m\u001B[4mcolorize.red.bold.underline(red)\u001B[24m\u001B[22m\u001B[39m\n" +
            "\u001B[93m\u001B[1mhex('#FFAB40').bold('#63ffc6')\u001B[22m\u001B[39m\n" +
            "\u001B[93m\u001B[1mcolorize.hex('#FFAB40').bold(#63ffc6)\u001B[22m\u001B[39m\n" +
            "\u001B[1m\u001B[31mcolorize2.bold.red\u001B[39m\u001B[22m\n" +
            "colored:  \u001B[32mgreen text\u001B[39m\n" +
            "striped:  green text";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});
