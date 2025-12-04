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
            env: { FORCE_COLOR: "2" },
            versions: { ...process.versions },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it(`should convert true-color to ANSI 256 color space`, async () => {
        expect.assertions(1);

        const { ansi256, hex } = await import("../../dist/index.server");

        const received = hex("#00c200")`foo bar`;
        const expected = ansi256(40)`foo bar`;

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should convert true-color to ANSI 256 color space (cjs)`, () => {
        expect.assertions(1);

        const distPath = join(testDirectory, "../../dist/index.server.cjs");
        // eslint-disable-next-line import/no-dynamic-require
        const { ansi256: ansi256Cjs, hex: hexCjs } = require(distPath);

        const received = hexCjs("#00c200")`foo bar`;
        const expected = ansi256Cjs(40)`foo bar`;

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});
