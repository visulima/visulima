// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkIsSafari, clamp, pixelToNumber } from "../../../src/toolbar/utils/index";

describe("toolbar/utils", () => {
    describe(clamp, () => {
        it("returns the value when inside the range", () => {
            expect.assertions(1);

            expect(clamp(5, 0, 10)).toBe(5);
        });

        it("clamps to the minimum", () => {
            expect.assertions(1);

            expect(clamp(-3, 0, 10)).toBe(0);
        });

        it("clamps to the maximum", () => {
            expect.assertions(1);

            expect(clamp(99, 0, 10)).toBe(10);
        });
    });

    describe(pixelToNumber, () => {
        it("strips a px suffix and parses the number", () => {
            expect.assertions(1);

            expect(pixelToNumber("12px")).toBe(12);
        });

        it("parses a numeric string with no px suffix", () => {
            expect.assertions(1);

            expect(pixelToNumber("42")).toBe(42);
        });

        it("returns a number argument unchanged", () => {
            expect.assertions(1);

            expect(pixelToNumber(7)).toBe(7);
        });
    });

    describe(checkIsSafari, () => {
        const userAgentGetter = vi.spyOn(navigator, "userAgent", "get");

        afterEach(() => {
            userAgentGetter.mockReset();
        });

        it("returns true for a Safari user agent without Chrome", () => {
            expect.assertions(1);

            userAgentGetter.mockReturnValue("Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17 Safari/605");

            expect(checkIsSafari()).toBe(true);
        });

        it("returns false for a Chrome user agent (which also contains Safari)", () => {
            expect.assertions(1);

            userAgentGetter.mockReturnValue("Mozilla/5.0 AppleWebKit/537 Chrome/120 Safari/537");

            expect(checkIsSafari()).toBe(false);
        });

        it("returns false for a non-Safari user agent", () => {
            expect.assertions(1);

            userAgentGetter.mockReturnValue("Mozilla/5.0 Firefox/121");

            expect(checkIsSafari()).toBe(false);
        });
    });
});
