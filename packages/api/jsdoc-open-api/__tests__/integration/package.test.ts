import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { execBin, execScriptSync, typeCheckFixture } from "../helpers";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { version: string };

describe("usage `@visulima/jsdoc-open-api` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(packageRoot, "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(received).toBe("ok");
    });

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

    it(`should expose working bin via --version`, () => {
        expect.assertions(3);

        const result = execBin(join(packageRoot, "bin/index.js"), ["--version"], { cwd: packageRoot });

        expect(result.code).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout).toBe(packageJson.version);
    });
});
