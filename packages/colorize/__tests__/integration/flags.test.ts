import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/cli/output.js");

// Note: using child_process.execSync the stdout.isTTY is always false

describe("enable colors", () => {
    it(`should support flag --color`, () => {
        expect.assertions(1);

        const received = execScriptSync(filename, ["--color"]);
        const expected = "\u001B[31mred\u001B[39m|\u001B[30mrgb\u001B[39m|\u001B[40mbgRgb\u001B[49m|\u001B[97mhex\u001B[39m|\u001B[107mbgHex\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support flag --color=true`, () => {
        expect.assertions(1);

        const received = execScriptSync(filename, ["--color=true"]);
        const expected = "\u001B[31mred\u001B[39m|\u001B[30mrgb\u001B[39m|\u001B[40mbgRgb\u001B[49m|\u001B[97mhex\u001B[39m|\u001B[107mbgHex\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support flag --color=always`, () => {
        expect.assertions(1);

        const received = execScriptSync(filename, ["--color=always"]);
        const expected = "\u001B[31mred\u001B[39m|\u001B[30mrgb\u001B[39m|\u001B[40mbgRgb\u001B[49m|\u001B[97mhex\u001B[39m|\u001B[107mbgHex\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support env FORCE_COLOR=true`, () => {
        expect.assertions(1);

        const received = execScriptSync(filename, [], ["FORCE_COLOR=true"]);
        const expected =
            "\u001B[31mred\u001B[39m|\u001B[38;2;80;80;80mrgb\u001B[39m|\u001B[48;2;80;80;80mbgRgb\u001B[49m|\u001B[38;2;255;255;255mhex\u001B[39m|\u001B[48;2;255;255;255mbgHex\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support env FORCE_COLOR=1`, () => {
        expect.assertions(1);

        const received = execScriptSync(filename, [], ["FORCE_COLOR=1"]);
        const expected = "\u001B[31mred\u001B[39m|\u001B[30mrgb\u001B[39m|\u001B[40mbgRgb\u001B[49m|\u001B[97mhex\u001B[39m|\u001B[107mbgHex\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});

describe("disable colors", () => {
    it(`should support flag --no-color`, () => {
        expect.assertions(1);

        // flags has priority over env variable
        const received = execScriptSync(filename, ["--no-color"], ["COLORTERM=truecolor"]);
        const expected = "red|rgb|bgRgb|hex|bgHex";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support flag --color=false`, () => {
        expect.assertions(1);

        // flags has priority over env variable
        const received = execScriptSync(filename, ["--color=false"], ["COLORTERM=truecolor"]);
        const expected = "red|rgb|bgRgb|hex|bgHex";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support flag --color=never`, () => {
        expect.assertions(1);

        // flags has priority over env variable
        const received = execScriptSync(filename, ["--color=never"], ["COLORTERM=truecolor"]);
        const expected = "red|rgb|bgRgb|hex|bgHex";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support env FORCE_COLOR=0`, () => {
        expect.assertions(1);

        const received = execScriptSync(filename, [], ["FORCE_COLOR=0"]);
        const expected = "red|rgb|bgRgb|hex|bgHex";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should support env NO_COLOR=1`, () => {
        expect.assertions(1);

        const received = execScriptSync(filename, [], ["NO_COLOR=1"]);
        const expected = "red|rgb|bgRgb|hex|bgHex";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});
