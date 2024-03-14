import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/package` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(2);

        const filename = join(__dirname, "../..", "__fixtures__/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(esc(received)).toContain(`path: '${join(__dirname, "..", "..", "package.json")}'`);
        expect(esc(received)).toContain(`  packageJson: {\n    name: '@visulima/package',`);
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(2);

        const filename = join(__dirname, "../..", "__fixtures__/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(esc(received)).toContain(`path: '${join(__dirname, "..", "..", "package.json")}'`);
        expect(esc(received)).toContain(`  packageJson: {\n    name: '@visulima/package',`);
    });
});
