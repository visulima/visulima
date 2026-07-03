import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync, typeCheckFixture } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/redact` npm package", () => {
    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename = join(__dirname, "..", "..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(esc(received)).toBe("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>.\n<FIRSTNAME> <LASTNAME> will be 30 on <DATE>.");
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const packageRoot = join(__dirname, "..", "..");
        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
