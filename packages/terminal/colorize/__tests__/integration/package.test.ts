import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync, normalizeFunctionNames, typeCheckFixture } from "../helpers";

describe("usage `@visulima/colorize` npm package", () => {
    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename, ["--color"]);

        const expected
            = "[Function: self] Object { strip: [Function (anonymous)] }\n"
                + "[91m[7m -= [colorize package] ESM =- [27m[39m\n"
                + "[31m[1m[4mred.bold.underline('red')[24m[22m[39m\n"
                + "[31m[1m[4mcolorize.red.bold.underline(red)[24m[22m[39m\n"
                + "[93m[1mhex('#FFAB40').bold('#63ffc6')[22m[39m\n"
                + "[93m[1mcolorize.hex('#FFAB40').bold(#63ffc6)[22m[39m\n"
                + "[1m[31mcolorize2.bold.red[39m[22m\n"
                + "colored:  [32mgreen text[39m\n"
                + "striped:  green text";

        // Normalize `[Function: name]` tokens: the production build minifies `self`/`Colorize`,
        // so this dist-runtime test verifies structure, not minifier-mangled identifiers.
        expect(esc(normalizeFunctionNames(received))).toStrictEqual(esc(normalizeFunctionNames(expected)));
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
