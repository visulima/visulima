import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { execScriptSync, typeCheckFixture } from "../helpers";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");

describe("usage `@visulima/interactive-manager` npm package", () => {
    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(packageRoot, "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toBe("ok");
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
