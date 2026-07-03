import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { execScriptSync, typeCheckFixture } from "../helpers";

describe("usage `@visulima/path` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(received).toBe("/\n/");
    });

    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toBe("/\n/");
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
