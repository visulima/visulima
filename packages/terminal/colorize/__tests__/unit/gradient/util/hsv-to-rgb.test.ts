import { describe, expect, it } from "vitest";

import { hsvToRgb } from "../../../../src/gradient/util/hsv-to-rgb";

describe(hsvToRgb, () => {
    it.each([
        ["index%6 === 0", 10, { b: 0, g: 42, r: 255 }],
        ["index%6 === 1", 70, { b: 0, g: 255, r: 212 }],
        ["index%6 === 2", 130, { b: 42, g: 255, r: 0 }],
        ["index%6 === 3", 190, { b: 255, g: 213, r: 0 }],
        ["index%6 === 4", 250, { b: 255, g: 0, r: 43 }],
        ["index%6 === 5", 310, { b: 212, g: 0, r: 255 }],
    ])("should convert hue covering %s", (_, hue, expected) => {
        expect.assertions(1);

        expect(hsvToRgb(hue, 1, 1)).toStrictEqual(expected);
    });

    it("should convert pure white (saturation 0)", () => {
        expect.assertions(1);

        expect(hsvToRgb(0, 0, 1)).toStrictEqual({ b: 255, g: 255, r: 255 });
    });

    it("should convert pure black (value 0)", () => {
        expect.assertions(1);

        expect(hsvToRgb(0, 0, 0)).toStrictEqual({ b: 0, g: 0, r: 0 });
    });
});
