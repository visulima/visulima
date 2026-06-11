import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync, typeCheckFixture } from "../helpers";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");

describe("usage `@visulima/pail` npm package", () => {
    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename = join(packageRoot, "__fixtures__/package/mjs/test.mjs");

        const received = await execScriptSync(filename);

        expect(received).toBe("ok");
    });

    it.each(["server", "browser"])(`should export correct and working ESM code for pail %s`, async (name: string) => {
        expect.assertions(1);

        const filename = join(packageRoot, "__fixtures__/package/mjs", `pail.${name}.mjs`);
        const received = await execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            date: expect.any(String),
            groups: [],
            label: "warning",
            message: "esm",
            scope: [],
        });
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
