import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/pail` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(__dirname, "../..", "__fixtures__/package/cjs/test.cjs");
        const received = execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            date: expect.any(String),
            groups: [],
            label: "success",
            message: "cjs",
            scope: [],
        });
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename = join(__dirname, "../..", "__fixtures__/package/mjs/test.mjs");
        const received = execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            date: expect.any(String),
            groups: [],
            label: "success",
            message: "esm",
            scope: [],
        });
    });
});
