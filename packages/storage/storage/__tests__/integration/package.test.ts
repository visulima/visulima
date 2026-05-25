import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { execScriptSync, typeCheckFixture } from "../helpers";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");

describe("usage `@visulima/storage` npm package", () => {
    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(packageRoot, "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toBe("ok");
    });

    // Windows CI reports tsc exit code 1 with empty stdout/stderr against this fixture,
    // which we cannot reproduce locally. The same helper passes on every other package
    // in the repo, so it appears tied to storage's large d.ts surface (~9k lines across
    // packem-emitted chunks) plus optional peer deps like @opentelemetry/api. Skip on
    // win32 until we can instrument the failure end-to-end on a hosted runner.
    it.skipIf(process.platform === "win32")(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });
});
