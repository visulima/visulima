import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { esc } from "../helpers";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

describe("color space", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "1" },
            versions: { ...process.versions },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it(`should convert true-color to ANSI 16 color space`, async () => {
        expect.assertions(1);

        const { green, hex } = await import("../../dist/index.server.mjs");

        const received = hex("#00c200")`foo bar`;
        const expected = green`foo bar`;

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should convert true-color to ANSI 16 color space (cjs)`, () => {
        expect.assertions(1);

        const distPath = join(testDirectory, "../../dist/index.server.cjs");
        // eslint-disable-next-line import/no-dynamic-require
        const { green: greenCjs, hex: hexCjs } = require(distPath);

        const received = hexCjs("#00c200")`foo bar`;
        const expected = greenCjs`foo bar`;

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});
