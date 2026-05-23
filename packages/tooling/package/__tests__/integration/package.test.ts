import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { esc, execScriptSync, typeCheckFixture } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/package` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(__dirname, "..", "..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            name: "@visulima/package",
            path: join(__dirname, "..", "..", "package.json"),
        });
    });

    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(__dirname, "..", "..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            name: "@visulima/package",
            path: join(__dirname, "..", "..", "package.json"),
        });
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const packageRoot = join(__dirname, "..", "..");
        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
