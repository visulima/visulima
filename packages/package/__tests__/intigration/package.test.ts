import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/package` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(3);

        const filename = join(__dirname, "../..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(esc(received)).toContain(`path: '`);
        expect(esc(received)).toContain(`packageJson: {\n    name: '@visulima/package',`);
        expect(esc(received)).toContain(`'@visulima/package'`);
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(3);

        const filename = join(__dirname, "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(esc(received)).toContain(`path: '`);
        expect(esc(received)).toContain(`packageJson: {`);
        expect(esc(received)).toContain(`'@visulima/package'`);
    });
});
