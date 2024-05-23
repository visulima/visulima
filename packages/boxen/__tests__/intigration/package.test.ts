import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { execScriptSync } from "../helpers";

describe("usage `@visulima/boxen` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename: string = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(received).toMatchSnapshot();
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename: string = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toMatchSnapshot();
    });
});
