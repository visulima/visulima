import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { execScriptSync, typeCheckFixture } from "../helpers";

describe("usage `@visulima/ansi` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename: string = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(received).toMatchSnapshot();
    });

    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename: string = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toMatchSnapshot();
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
