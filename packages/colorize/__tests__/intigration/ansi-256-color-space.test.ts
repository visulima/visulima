import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { esc } from "../helpers";

describe("color space", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "2" },
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
});
