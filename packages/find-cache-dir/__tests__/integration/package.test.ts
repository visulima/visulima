import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { execScriptSync } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/find-cache-directory` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(__dirname, "..", "..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(received).toStrictEqual(join(__dirname, "..", "..", "node_modules", ".cache"));
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename = join(__dirname, "..", "..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toStrictEqual(join(__dirname, "..", "..", "node_modules", ".cache"));
    });
});
