import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/package` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(__dirname, "..", "..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            config: expect.objectContaining({
                $schema: "https://json.schemastore.org/tsconfig",
            }),
            path: join(__dirname, "..", "..", "tsconfig.json"),
        });
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename = join(__dirname, "..", "..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            config: expect.objectContaining({
                $schema: "https://json.schemastore.org/tsconfig",
            }),
            path: join(__dirname, "..", "..", "tsconfig.json"),
        });
    });
});
