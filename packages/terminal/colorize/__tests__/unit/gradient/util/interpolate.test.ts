import { describe, expect, it } from "vitest";

import { interpolateHsv, interpolateRgb } from "../../../../src/gradient/util/interpolate";
import type { StopOutput } from "../../../../src/types";

const stop = (color: [number, number, number]): StopOutput => {
    return { color, colorLess: false, position: 0 };
};

describe(interpolateRgb, () => {
    it("should interpolate between two RGB stops", () => {
        expect.assertions(1);

        expect(interpolateRgb(stop([255, 0, 0]), stop([0, 128, 0]), 3)).toStrictEqual([
            { b: 0, g: 0, r: 255 },
            { b: 0, g: 42, r: 170 },
            { b: 0, g: 85, r: 85 },
        ]);
    });

    it("should return only the start color when a single step is requested", () => {
        expect.assertions(1);

        expect(interpolateRgb(stop([255, 0, 0]), stop([0, 128, 0]), 1)).toStrictEqual([{ b: 0, g: 0, r: 255 }]);
    });

    it("should use a zero step size when zero steps are requested", () => {
        expect.assertions(1);

        // Exercises the `steps === 0 ? 0` guard inside the step-size calculation.
        expect(interpolateRgb(stop([10, 20, 30]), stop([40, 50, 60]), 0)).toStrictEqual([{ b: 30, g: 20, r: 10 }]);
    });
});

describe(interpolateHsv, () => {
    it("should fall back to RGB interpolation when a stop is greyscale", () => {
        expect.assertions(1);

        expect(interpolateHsv(stop([100, 100, 100]), stop([0, 128, 0]), 3, "short")).toStrictEqual([
            { b: 100, g: 100, r: 100 },
            { b: 66, g: 109, r: 66 },
            { b: 33, g: 118, r: 33 },
        ]);
    });

    it("should use the boolean mode for trigonometric direction (true)", () => {
        expect.assertions(1);

        expect(interpolateHsv(stop([255, 0, 0]), stop([0, 0, 255]), 3, true)).toStrictEqual([
            { b: 0, g: 0, r: 255 },
            { b: 170, g: 0, r: 255 },
            { b: 255, g: 0, r: 170 },
        ]);
    });

    it("should use the boolean mode for trigonometric direction (false)", () => {
        expect.assertions(1);

        expect(interpolateHsv(stop([255, 0, 0]), stop([0, 0, 255]), 3, false)).toStrictEqual([
            { b: 0, g: 0, r: 255 },
            { b: 0, g: 255, r: 170 },
            { b: 170, g: 255, r: 0 },
        ]);
    });

    it("should resolve the short arc for an ascending hue", () => {
        expect.assertions(1);

        expect(interpolateHsv(stop([255, 0, 0]), stop([0, 128, 0]), 3, "short")).toStrictEqual([
            { b: 0, g: 0, r: 255 },
            { b: 0, g: 142, r: 213 },
            { b: 0, g: 170, r: 114 },
        ]);
    });

    it("should resolve the long arc for an ascending hue", () => {
        expect.assertions(1);

        expect(interpolateHsv(stop([255, 0, 0]), stop([0, 128, 0]), 3, "long")).toStrictEqual([
            { b: 0, g: 0, r: 255 },
            { b: 213, g: 0, r: 142 },
            { b: 170, g: 114, r: 0 },
        ]);
    });

    it("should resolve the short arc for a descending hue", () => {
        expect.assertions(1);

        expect(interpolateHsv(stop([0, 0, 255]), stop([255, 0, 0]), 3, "short")).toStrictEqual([
            { b: 255, g: 0, r: 0 },
            { b: 255, g: 0, r: 170 },
            { b: 170, g: 0, r: 255 },
        ]);
    });

    it("should resolve the long arc for a descending hue", () => {
        expect.assertions(1);

        expect(interpolateHsv(stop([0, 0, 255]), stop([255, 0, 0]), 3, "long")).toStrictEqual([
            { b: 255, g: 0, r: 0 },
            { b: 170, g: 255, r: 0 },
            { b: 0, g: 255, r: 170 },
        ]);
    });
});
