import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { execScriptSync } from "../helpers";

describe("usage `@visulima/path` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(received).toBe("/\n/");
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toBe("/\n/");
    });
});
