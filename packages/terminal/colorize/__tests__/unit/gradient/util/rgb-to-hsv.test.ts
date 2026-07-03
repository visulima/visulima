import { describe, expect, it } from "vitest";

import { rgbToHsv } from "../../../../src/gradient/util/rgb-to-hsv";

describe(rgbToHsv, () => {
    it("should return zeroed hue/saturation for black", () => {
        expect.assertions(1);

        expect(rgbToHsv({ b: 0, g: 0, r: 0 })).toStrictEqual({ h: 0, s: 0, v: 0 });
    });

    it("should compute hue when max channel is red", () => {
        expect.assertions(1);

        expect(rgbToHsv({ b: 0, g: 0, r: 255 })).toStrictEqual({ h: 0, s: 1, v: 1 });
    });

    it("should compute hue when max channel is green", () => {
        expect.assertions(1);

        const result = rgbToHsv({ b: 0, g: 255, r: 0 });

        expect(result.h).toBeCloseTo(120, 5);
    });

    it("should compute hue when max channel is blue", () => {
        expect.assertions(1);

        expect(rgbToHsv({ b: 255, g: 0, r: 0 })).toStrictEqual({ h: 240, s: 1, v: 1 });
    });

    it("should wrap negative intermediate hue back into range", () => {
        expect.assertions(1);

        // Magenta produces an intermediate hue < 0, exercising the `h += 1` correction.
        const result = rgbToHsv({ b: 15, g: 0, r: 15 });

        expect(result.h).toBeCloseTo(300, 5);
    });
});
