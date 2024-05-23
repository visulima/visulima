import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

const strip = (string: string): string => esc(stripAnsi(string)).replaceAll("\r\n", "\n").trimEnd();

describe("usage `@visulima/cerebro` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(strip(received)).toMatchSnapshot();
    });

    it(`should work as ESM package`, async () => {
        expect.assertions(1);

        const filename = join(dirname(fileURLToPath(import.meta.url)), "../..", "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(strip(received)).toMatchSnapshot();
    });
});
