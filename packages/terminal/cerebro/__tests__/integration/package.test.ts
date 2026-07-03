import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { esc, execScriptSync, typeCheckFixture } from "../helpers";

const strip = (string: string): string => esc(stripVTControlCharacters(string)).replaceAll("\r\n", "\n").trimEnd();

describe("usage `@visulima/cerebro` npm package", () => {
    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(strip(received)).toMatchSnapshot();
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
