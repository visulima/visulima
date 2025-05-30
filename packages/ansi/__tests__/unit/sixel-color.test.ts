import { beforeEach, describe, expect, it } from "vitest";

import {
    decodeSixelColor,
    updatePalette,
    // hslToRgb is not exported, so test it indirectly via decodeSixelColor HLS cases or add specific tests if exposed
} from "../../src/sixel/color";
import type { DecodedSixelColorCommand, SixelColor, SixelPalette } from "../../src/sixel/types";

// Helper to access hslToRgb for direct testing if needed, or make it exportable for testing
// For now, testing it via decodeSixelColor's HLS path.

describe("sixel Color Utilities", () => {
    describe(decodeSixelColor, () => {
        it("should parse simple palette selection", () => {
            expect.assertions(1);

            const result = decodeSixelColor("#5", 0);

            expect(result).toStrictEqual({ cmd: { paletteIndex: 5 }, consumed: 2 });
        });

        it("should parse RGB definition", () => {
            expect.assertions(4);

            const result = decodeSixelColor("#1;2;100;0;0", 0);

            expect(result?.cmd.paletteIndex).toBe(1);
            expect(result?.cmd.colorSpace).toBe("RGB");
            expect(result?.cmd.colorDefinition).toStrictEqual({ b: 0, g: 0, r: 255 });
            expect(result?.consumed).toBe(12); // #1;2;100;0;0
        });

        it("should parse HLS definition and convert to RGB", () => {
            expect.assertions(4);

            // H:120 (Green), L:50, S:100
            const result = decodeSixelColor("#2;1;120;50;100", 0);

            expect(result?.cmd.paletteIndex).toBe(2);
            expect(result?.cmd.colorSpace).toBe("HLS");
            expect(result?.cmd.colorDefinition).toStrictEqual({ b: 0, g: 255, r: 0 });
            expect(result?.consumed).toBe(15); // #2;1;120;50;100
        });

        it("should parse HLS definition for black (L=0)", () => {
            expect.assertions(1);

            const result = decodeSixelColor("#3;1;0;0;0", 0); // H:0, L:0, S:0

            expect(result?.cmd.colorDefinition).toStrictEqual({ b: 0, g: 0, r: 0 });
        });

        it("should parse HLS definition for white (L=100, S=0)", () => {
            expect.assertions(1);

            const result = decodeSixelColor("#4;1;0;100;0", 0); // H:0, L:100, S:0

            expect(result?.cmd.colorDefinition).toStrictEqual({ b: 255, g: 255, r: 255 });
        });

        it("should parse HLS definition for gray (L=50, S=0)", () => {
            expect.assertions(1);

            const result = decodeSixelColor("#5;1;0;50;0", 0); // H:0, L:50, S:0

            expect(result?.cmd.colorDefinition).toStrictEqual({ b: 128, g: 128, r: 128 }); // Or 127 due to rounding
        });

        it("should handle RGB parameter clamping (values 0-100)", () => {
            expect.assertions(1);

            const result = decodeSixelColor("#3;2;120;-20;50", 0);

            // Expected: R=100 (scaled to 255), G=0 (scaled to 0), B=50 (scaled to 128)
            expect(result?.cmd.colorDefinition).toStrictEqual({ b: 128, g: 0, r: 255 });
        });

        it("should handle HLS parameter clamping", () => {
            expect.assertions(2);

            // H:400 (becomes 40), L:150 (becomes 100), S:-10 (becomes 0)
            const result = decodeSixelColor("#4;1;400;150;0", 0);

            // Expected: H:40, L:100, S:0 => White
            expect(result?.cmd.colorDefinition).toStrictEqual({ b: 255, g: 255, r: 255 });

            // H: -90 (becomes 270 with modulo, effectively 0 with clamping to 0-360 then modulo), L:50, S:120 (becomes 100)
            // If H becomes 0, S=100, L=50 => Red
            const result2 = decodeSixelColor("#4;1;-90;50;120", 0);

            expect(result2?.cmd.colorDefinition).toStrictEqual({ b: 0, g: 0, r: 255 });
        });

        it("should handle non-numeric Px,Py,Pz gracefully", () => {
            expect.assertions(5);

            const result = decodeSixelColor("#1;2;10;foo;30", 0);

            expect(result).not.toBeNull();
            expect(result?.cmd.paletteIndex).toBe(1);
            expect(result?.cmd.colorDefinition).toBeUndefined();
            expect(result?.cmd.colorSpace).toBeUndefined();
            expect(result?.consumed).toBe(8); // #1;2;10;f (breaks at 'f')
        });

        it("should return null for invalid Pc or missing Pc", () => {
            expect.assertions(2);
            expect(decodeSixelColor("#", 0)).toBeUndefined();
            expect(decodeSixelColor("#abc", 0)).toBeUndefined(); // non-numeric Pc
        });

        it("should handle missing optional parameters gracefully", () => {
            expect.assertions(6);

            let result = decodeSixelColor("#10;2", 0); // Pc, Pu, but no Px,Py,Pz

            expect(result?.cmd.paletteIndex).toBe(10);
            expect(result?.cmd.colorDefinition).toBeUndefined();
            expect(result?.consumed).toBe(5); // #10;2

            result = decodeSixelColor("#11;2;10", 0); // Pc, Pu, Px, but no Py,Pz

            expect(result?.cmd.paletteIndex).toBe(11);
            expect(result?.cmd.colorDefinition).toBeUndefined();
            expect(result?.consumed).toBe(8); // #11;2;10
        });

        it("should handle invalid Pu gracefully", () => {
            expect.assertions(4);

            const result = decodeSixelColor("#12;3;10;20;30", 0); // Pu=3 is invalid

            expect(result?.cmd.paletteIndex).toBe(12);
            expect(result?.cmd.colorDefinition).toBeUndefined();
            expect(result?.cmd.colorSpace).toBeUndefined();
            expect(result?.consumed).toBe(14); // #12;3;10;20;30 (Corrected from 15)
        });

        it("should correctly report consumed characters", () => {
            expect.assertions(4);
            expect(decodeSixelColor("#1", 0)?.consumed).toBe(2);
            expect(decodeSixelColor("#12", 0)?.consumed).toBe(3);
            expect(decodeSixelColor("#1;2;3;4;5", 0)?.consumed).toBe(10); // #1;2;3;4;5
            expect(decodeSixelColor("#1;2;3;4;5trailing", 0)?.consumed).toBe(10);
        });
    });

    describe(updatePalette, () => {
        let palette: SixelPalette;

        beforeEach(() => {
            palette = {
                colors: [],
                maxSize: 256, // Default typical max size
            };
        });

        it("should update color at a valid index", () => {
            expect.assertions(3);

            const color: SixelColor = { b: 30, g: 20, r: 10 };

            updatePalette(palette, 0, color);

            expect(palette.colors[0]).toStrictEqual(color);

            const color2: SixelColor = { b: 60, g: 50, r: 40 };

            updatePalette(palette, 5, color2);

            expect(palette.colors[5]).toStrictEqual(color2);

            // Test updating an existing color
            const color3: SixelColor = { b: 90, g: 80, r: 70 };

            updatePalette(palette, 5, color3); // Overwrite index 5

            expect(palette.colors[5]).toStrictEqual(color3);
        });

        it("should not update color for negative index", () => {
            expect.assertions(2);

            const color: SixelColor = { b: 30, g: 20, r: 10 };

            updatePalette(palette, -1, color);

            expect(palette.colors[-1]).toBeUndefined();
            // Ensure no other indices were accidentally written to
            expect(Object.keys(palette.colors)).toHaveLength(0);
        });

        it("should not update if index equals or exceeds maxSize", () => {
            expect.assertions(4);

            const color: SixelColor = { b: 30, g: 20, r: 10 };

            // Test at maxSize
            updatePalette(palette, 256, color);

            expect(palette.colors[256]).toBeUndefined();

            // Test above maxSize
            updatePalette(palette, 257, color);

            expect(palette.colors[257]).toBeUndefined();

            // Test with a smaller maxSize
            palette.maxSize = 10;
            updatePalette(palette, 10, color); // index 10 is not < maxSize 10

            expect(palette.colors[10]).toBeUndefined();

            updatePalette(palette, 9, color); // index 9 is < maxSize 10

            expect(palette.colors[9]).toStrictEqual(color);
        });
    });
});
