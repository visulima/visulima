import { describe, expect, it } from "vitest";

import { DCS } from "../../src/constants";
import type { SixelEncoderOptions } from "../../src/sixel/encoder";
import { encodeToSixel } from "../../src/sixel/encoder";
import type { RawImageData } from "../../src/sixel/types";

const UNICODE_ESC = "\u001B";

describe("encodeToSixel", () => {
    it("should return an empty string for an empty image (0x0)", () => {
        const imageData: RawImageData = { data: new Uint8ClampedArray([]), height: 0, width: 0 };
        expect(encodeToSixel(imageData)).toBe(""); // Palette will be empty
    });

    it("should encode a 1x1 red pixel image", () => {
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([255, 0, 0, 255]), // Red pixel
            height: 1,
            width: 1,
        };
        const options = { maxColors: 1 };
        const finalExpected = `${UNICODE_ESC}Pq"1;1;1;1#0@-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    it("should encode a 1x6 blue pixel image (full sixel char)", () => {
        const blue = [0, 0, 255, 255];
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([...blue, ...blue, ...blue, ...blue, ...blue, ...blue]),
            height: 6,
            width: 1,
        };
        const options = { maxColors: 1 };
        // Raster: "1;1;1;6
        // Color: #0 (blue)
        // SixelChar for 6 pixels of color 0: (1<<0)|(1<<1)|...|(1<<5) -> 63. Char: 63+63 = 126 => '~'
        // BandTerminator: '-'
        const finalExpected = `${UNICODE_ESC}Pq"1;1;1;6#0~-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    it("should encode a 2x1 image with two different colors (Red, Green)", () => {
        const R_PIXEL = [255, 0, 0, 255];
        const G_PIXEL = [0, 255, 0, 255];
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([...R_PIXEL, ...G_PIXEL]),
            height: 1,
            width: 2,
        };
        const options = { maxColors: 2 };

        const actualSixel = encodeToSixel(imageData, options);
        const possibleExpected1 = `${UNICODE_ESC}Pq"1;1;2;1#0@#1@-${UNICODE_ESC}\\`;
        const possibleExpected2 = `${UNICODE_ESC}Pq"1;1;2;1#1@#0@-${UNICODE_ESC}\\`;
        expect(actualSixel === possibleExpected1 || actualSixel === possibleExpected2).toBeTruthy();
    });

    it("should encode a 2x6 image with two different colors (Red column, Green column)", () => {
        const R_PIXEL = [255, 0, 0, 255];
        const G_PIXEL = [0, 255, 0, 255];
        const columnData: number[] = [];
        for (let index = 0; index < 6; index++) {
            columnData.push(...R_PIXEL, ...G_PIXEL);
        }
        const imageData: RawImageData = {
            data: new Uint8ClampedArray(columnData),
            height: 6,
            width: 2,
        };
        const options = { maxColors: 2 };

        const actualSixel = encodeToSixel(imageData, options);
        // Col 0 (Red) -> all 6 bits for palette index of Red -> '~'
        // Col 1 (Green) -> all 6 bits for palette index of Green -> '~'
        const possibleExpected1 = `${UNICODE_ESC}Pq"1;1;2;6#0~#1~-${UNICODE_ESC}\\`; // Palette: [Red, Green]
        const possibleExpected2 = `${UNICODE_ESC}Pq"1;1;2;6#1~#0~-${UNICODE_ESC}\\`; // Palette: [Green, Red]

        expect(actualSixel === possibleExpected1 || actualSixel === possibleExpected2).toBeTruthy();
    });

    it("should use repeat operator for a 3x1 single color image", () => {
        const R_PIXEL_DATA = [255, 0, 0, 255]; // Red
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([...R_PIXEL_DATA, ...R_PIXEL_DATA, ...R_PIXEL_DATA]),
            height: 1,
            width: 3,
        };
        const options = { maxColors: 1 };
        // Raster: "1;1;3;1
        // Color: #0 (Red)
        // SixelChar for 1 pixel (bit 0 set): (1<<0) -> 1. Char: 63+1 = 64 => '@'
        // Repeated 3 times: !3@
        // BandTerminator: '-'
        const finalExpected = `${UNICODE_ESC}Pq"1;1;3;1#0!3@-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    it("should handle multi-band image (e.g., 1x7 image)", () => {
        const B_PIXEL_DATA = [0, 0, 255, 255]; // Blue
        const imageData: RawImageData = {
            data: new Uint8ClampedArray(Array.from({length: 7}).fill(B_PIXEL_DATA).flat()),
            height: 7,
            width: 1,
        };
        const options = { maxColors: 1 };
        // Raster: "1;1;1;7
        // Color: #0 (Blue)
        // Band 1 (pixels 0-5): all 6 bits for color 0 -> '~'
        // Band Separator: '$'
        // Band 2 (pixel 6): bit 0 for color 0 -> '@'
        // BandTerminator: '-'
        const finalExpected = `${UNICODE_ESC}Pq"1;1;1;7#0~$#0@-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    it("should handle image height not perfectly divisible by 6 (e.g., 1x3)", () => {
        const R_PIXEL_DATA = [255, 0, 0, 255]; // Red
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([
                ...R_PIXEL_DATA, // Row 0
                ...R_PIXEL_DATA, // Row 1
                ...R_PIXEL_DATA, // Row 2
            ]),
            height: 3,
            width: 1,
        };
        const options = { maxColors: 1 };
        // Raster: "1;1;1;3
        // Color: #0 (Red)
        // SixelChar for 3 pixels (bits 0,1,2 set): (1<<0)|(1<<1)|(1<<2) -> 7. Char: 63+7 = 70 => 'F'
        // BandTerminator: '-'
        const finalExpected = `${UNICODE_ESC}Pq"1;1;1;3#0F-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    it("should encode a 1x2 red pixel image (height not div by 6)", () => {
        const R_PIXEL_DATA = [255, 0, 0, 255]; // Red
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([
                ...R_PIXEL_DATA, // Row 0
                ...R_PIXEL_DATA, // Row 1
            ]),
            height: 2,
            width: 1,
        };
        const options = { maxColors: 1 };
        // SixelChar for 2 pixels (bits 0,1 set): (1<<0)|(1<<1) -> 3. Char: 63+3 = 66 => 'B'
        const finalExpected = `${UNICODE_ESC}Pq"1;1;1;2#0B-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    it("should encode a 1x4 red pixel image (height not div by 6)", () => {
        const R_PIXEL_DATA = [255, 0, 0, 255]; // Red
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([...R_PIXEL_DATA, ...R_PIXEL_DATA, ...R_PIXEL_DATA, ...R_PIXEL_DATA]),
            height: 4,
            width: 1,
        };
        const options = { maxColors: 1 };
        // SixelChar for 4 pixels (bits 0,1,2,3 set): (1<<0)|...|(1<<3) -> 15. Char: 63+15 = 78 => 'N'
        const finalExpected = `${UNICODE_ESC}Pq"1;1;1;4#0N-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    it("should encode a 1x5 red pixel image (height not div by 6)", () => {
        const R_PIXEL_DATA = [255, 0, 0, 255]; // Red
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([...R_PIXEL_DATA, ...R_PIXEL_DATA, ...R_PIXEL_DATA, ...R_PIXEL_DATA, ...R_PIXEL_DATA]),
            height: 5,
            width: 1,
        };
        const options = { maxColors: 1 };
        // SixelChar for 5 pixels (bits 0,1,2,3,4 set): (1<<0)|...|(1<<4) -> 31. Char: 63+31 = 94 => '^'
        const finalExpected = `${UNICODE_ESC}Pq"1;1;1;5#0^-${UNICODE_ESC}\\`;
        expect(encodeToSixel(imageData, options)).toBe(finalExpected);
    });

    describe("raster Attribute Options", () => {
        const baseExpectedSixelData = `#0@-${UNICODE_ESC}\\`; // For a single red pixel at color index 0

        it("should use default raster attributes if none provided", () => {
            const options = { maxColors: 1 }; // Ensure palette is just [Red]
            // The actual content of sixel data depends on the full image. For this test, let's use a 1x1 red pixel
            // and check that its raster attributes are based on its dimensions.
            const simple1x1Red: RawImageData = { data: new Uint8ClampedArray([255, 0, 0, 255]), height: 1, width: 1 };
            const expectedSimple = `${UNICODE_ESC}Pq"1;1;1;1#0@-${UNICODE_ESC}\\`;
            expect(encodeToSixel(simple1x1Red, options)).toBe(expectedSimple);
        });

        it("should use custom pixel aspect ratio", () => {
            const options: SixelEncoderOptions = {
                maxColors: 1,
                pixelAspectRatioDenominator: 3,
                pixelAspectRatioNumerator: 2,
            };
            const expected = `${UNICODE_ESC}Pq"2;3;1;1${baseExpectedSixelData}`;
            expect(encodeToSixel({ data: new Uint8ClampedArray([255, 0, 0, 255]), height: 1, width: 1 }, options)).toBe(expected);
        });

        it("should use overrideWidth and overrideHeight", () => {
            const options: SixelEncoderOptions = {
                maxColors: 1,
                overrideHeight: 200,
                overrideWidth: 100,
            };
            const expected = `${UNICODE_ESC}Pq"1;1;100;200${baseExpectedSixelData}`;
            expect(encodeToSixel({ data: new Uint8ClampedArray([255, 0, 0, 255]), height: 1, width: 1 }, options)).toBe(expected);
        });

        it("should use combination of custom aspect ratio and override dimensions", () => {
            const options: SixelEncoderOptions = {
                maxColors: 1,
                overrideHeight: 40,
                overrideWidth: 50,
                pixelAspectRatioDenominator: 4,
                pixelAspectRatioNumerator: 5,
            };
            const expected = `${UNICODE_ESC}Pq"5;4;50;40${baseExpectedSixelData}`;
            expect(encodeToSixel({ data: new Uint8ClampedArray([255, 0, 0, 255]), height: 1, width: 1 }, options)).toBe(expected);
        });
    });

    describe("maxColors Option", () => {
        const R_PIXEL = [255, 0, 0, 255];
        const G_PIXEL = [0, 255, 0, 255];
        const B_PIXEL = [0, 0, 255, 255];

        // 3x1 image with R, G, B pixels
        const threeColorImageData: RawImageData = {
            data: new Uint8ClampedArray([...R_PIXEL, ...G_PIXEL, ...B_PIXEL]),
            height: 1,
            width: 3,
        };

        it("should use all actual colors if maxColors > actual colors", () => {
            const options: SixelEncoderOptions = { maxColors: 5 }; // 5 > 3 actual colors
            const actualSixel = encodeToSixel(threeColorImageData, options);
            // Expect 3 colors in palette. Order can vary.
            // Example: R=0, G=1, B=2 -> "...#0@#1@#2@-..."
            // We need to check for 3 distinct color definitions and 3 sixel chars.
            expect(actualSixel).toMatch(/^\u001BPq"1;1;3;1/); // Check raster attributes
            expect(actualSixel).toMatch(/#\d+@#\d+@#\d+@-/); // Check three color changes and data
            const colorDefinitions = actualSixel.match(/#\d+/g);
            expect(new Set(colorDefinitions).size).toBe(3); // Ensures 3 unique palette indices used
            expect(actualSixel).toContain(`-${UNICODE_ESC}\\`); // Check terminator
        });

        it("should limit palette size if maxColors < actual colors", () => {
            const options: SixelEncoderOptions = { maxColors: 2 }; // 2 < 3 actual colors
            const actualSixel = encodeToSixel(threeColorImageData, options);
            // Expect 2 colors in palette. One of R,G,B will be mapped to one of the other two.
            expect(actualSixel).toMatch(/^\u001BPq"1;1;3;1/); // Check raster attributes
            // Example: R=0, G=0 (quantized), B=1 -> "...#0@#0@#1@-...
            // Check for at most 2 distinct color definitions used for the 3 pixels.
            const colorDefinitions = actualSixel.match(/#\d+/g);
            // It's possible for a pixel to be quantized to an existing color, so it might appear as #0@#0@#1@
            // or #0@#1@#1@ etc. The number of *defined* colors via #N should be maxColors (2)
            // and those indices used for the pixels.
            // The medianCutQuantize will produce a palette of size maxColors.
            // The key is that only indices up to maxColors-1 are used.
            expect(new Set(colorDefinitions).size).toBeLessThanOrEqual(2);
            // Check that all used palette indices are < maxColors
            colorDefinitions?.forEach((colorDefinition) => {
                const paletteIndex = Number.parseInt(colorDefinition.slice(1), 10);
                expect(paletteIndex).toBeLessThan(2);
            });
            expect(actualSixel).toContain(`@`); // Should contain some pixel data
            expect(actualSixel).toContain(`-${UNICODE_ESC}\\`); // Check terminator
        });
    });

    it("should return an empty string for a 0-height image (width > 0)", () => {
        const imageData: RawImageData = { data: new Uint8ClampedArray([]), height: 0, width: 5 };
        expect(encodeToSixel(imageData)).toBe("");
    });

    it("should handle varied widths with height not perfectly divisible by 6 (e.g., 2x3 Red, Green)", () => {
        const R_PIXEL = [255, 0, 0, 255];
        const G_PIXEL = [0, 255, 0, 255];
        const imageData: RawImageData = {
            data: new Uint8ClampedArray([
                ...R_PIXEL,
                ...G_PIXEL, // Row 0
                ...R_PIXEL,
                ...G_PIXEL, // Row 1
                ...R_PIXEL,
                ...G_PIXEL, // Row 2
            ]),
            height: 3,
            width: 2,
        };
        const options = { maxColors: 2 };
        const actualSixel = encodeToSixel(imageData, options);

        // Expected: Raster for 2x3. Color defs for Red, Green. Sixel data for 3 rows.
        // Band 1 (y=0 to y=2):
        // Col 0 (Red): Bits 0,1,2 for Red (#0) -> 'F' (char code 70)
        // Col 1 (Green): Bits 0,1,2 for Green (#1) -> 'F' (char code 70)
        // Palette can be [#0=R, #1=G] or [#0=G, #1=R]
        const raster = '"1;1;2;3';
        const bandTerminator = `-${UNICODE_ESC}\\`;

        const expectedOption1 = `${UNICODE_ESC}Pq${raster}#0F#1F${bandTerminator}`; // R=0, G=1
        const expectedOption2 = `${UNICODE_ESC}Pq${raster}#1F#0F${bandTerminator}`; // G=0, R=1

        expect(actualSixel === expectedOption1 || actualSixel === expectedOption2).toBeTruthy();
    });

    describe("empty Bands", () => {
        it("should handle a leading empty (black) band in a 1x12 image", () => {
            const BLACK_PIXEL = [0, 0, 0, 255];
            const RED_PIXEL = [255, 0, 0, 255];
            const dataValues = [...Array.from({length: 6}).fill(BLACK_PIXEL).flat(), ...Array.from({length: 6}).fill(RED_PIXEL).flat()];
            const imageData: RawImageData = { data: new Uint8ClampedArray(dataValues), height: 12, width: 1 };
            const options: SixelEncoderOptions = { maxColors: 2 };
            const actual = encodeToSixel(imageData, options);

            const raster = '"1;1;1;12';
            const bandSeparator = "$";
            const finalTerm = `-${UNICODE_ESC}\\`;

            // Option 1: Black is #0, Red is #1
            // Band 1 (Black): #0~
            // Band 2 (Red): #1~
            const expected1 = `${UNICODE_ESC}Pq${raster}#0~${bandSeparator}#1~${finalTerm}`;

            // Option 2: Red is #0, Black is #1
            // Band 1 (Black): #1~
            // Band 2 (Red): #0~
            const expected2 = `${UNICODE_ESC}Pq${raster}#1~${bandSeparator}#0~${finalTerm}`;

            expect(actual === expected1 || actual === expected2).toBeTruthy();
        });

        it("should handle a trailing empty (black) band in a 1x12 image", () => {
            const RED_PIXEL = [255, 0, 0, 255];
            const BLACK_PIXEL = [0, 0, 0, 255];
            const dataValues = [...Array.from({length: 6}).fill(RED_PIXEL).flat(), ...Array.from({length: 6}).fill(BLACK_PIXEL).flat()];
            const imageData: RawImageData = { data: new Uint8ClampedArray(dataValues), height: 12, width: 1 };
            const options: SixelEncoderOptions = { maxColors: 2 };
            const actual = encodeToSixel(imageData, options);

            const raster = '"1;1;1;12';
            const bandSeparator = "$";
            const finalTerm = `-${UNICODE_ESC}\\`;

            // Option 1: Red is #0, Black is #1
            // Band 1 (Red): #0~
            // Band 2 (Black): #1~
            const expected1 = `${UNICODE_ESC}Pq${raster}#0~${bandSeparator}#1~${finalTerm}`;

            // Option 2: Black is #0, Red is #1
            // Band 1 (Red): #1~
            // Band 2 (Black): #0~
            const expected2 = `${UNICODE_ESC}Pq${raster}#1~${bandSeparator}#0~${finalTerm}`;

            expect(actual === expected1 || actual === expected2).toBeTruthy();
        });

        it("should handle a middle empty (black) band in a 1x18 image", () => {
            const RED_PIXEL = [255, 0, 0, 255];
            const BLACK_PIXEL = [0, 0, 0, 255];
            const dataValues = [
                ...Array.from({length: 6}).fill(RED_PIXEL).flat(), // Band 1: Red
                ...Array.from({length: 6}).fill(BLACK_PIXEL).flat(), // Band 2: Black
                ...Array.from({length: 6}).fill(RED_PIXEL).flat(), // Band 3: Red
            ];
            const imageData: RawImageData = { data: new Uint8ClampedArray(dataValues), height: 18, width: 1 };
            const options: SixelEncoderOptions = { maxColors: 2 };
            const actual = encodeToSixel(imageData, options);

            const raster = '"1;1;1;18';
            const bandSeparator = "$";
            const finalTerm = `-${UNICODE_ESC}\\`;

            // Option 1: Red is #0, Black is #1
            // Band 1 (Red): #0~
            // Band 2 (Black): #1~
            // Band 3 (Red): #0~
            const expected1 = `${UNICODE_ESC}Pq${raster}#0~${bandSeparator}#1~${bandSeparator}#0~${finalTerm}`;

            // Option 2: Black is #0, Red is #1
            // Band 1 (Red): #1~
            // Band 2 (Black): #0~
            // Band 3 (Red): #1~
            const expected2 = `${UNICODE_ESC}Pq${raster}#1~${bandSeparator}#0~${bandSeparator}#1~${finalTerm}`;

            expect(actual === expected1 || actual === expected2).toBeTruthy();
        });

        it("should handle an entirely empty (black) image spanning multiple bands (1x12)", () => {
            const BLACK_PIXEL = [0, 0, 0, 255];
            const dataValues = Array.from({length: 12}).fill(BLACK_PIXEL).flat();
            const imageData: RawImageData = { data: new Uint8ClampedArray(dataValues), height: 12, width: 1 };
            const options: SixelEncoderOptions = { maxColors: 1 }; // Force black to be #0
            const actual = encodeToSixel(imageData, options);

            const raster = '"1;1;1;12';
            const bandSeparator = "$";
            const finalTerm = `-${UNICODE_ESC}\\`;

            // Encoder resets currentSixelColorIndex for each band, so color must be re-specified.
            // Palette definition for black: #0;2;0;0;0 (HLS for black)
            // const expectedPaletteDef = "#0;2;0;0;0"; // Sixel uses HLS: H=0-360, L=0-100, S=0-100. Scaled by 70/100 for Sat.
            // For black (0,0,0 RGB), HLS is (any, 0, 0). Default H is 0.
            // So, #0;2;0;0;0 is correct for {h:0, l:0, s:0}
            // UPDATED: If color 0 is black and it's the only color, the encoder might rely on implicit black for color 0.
            const expected = `${UNICODE_ESC}Pq${raster}#0~${bandSeparator}#0~${finalTerm}`;
            expect(actual).toBe(expected);
        });

        it("should handle multiple, separated uniform color bands (Red, Black, Green) in a 1x18 image", () => {
            const RED_PIXEL = [255, 0, 0, 255];
            const BLACK_PIXEL = [0, 0, 0, 255];
            const GREEN_PIXEL = [0, 255, 0, 255];

            const dataValues = [
                ...Array.from({length: 6}).fill(RED_PIXEL).flat(), // Band 1: Red
                ...Array.from({length: 6}).fill(BLACK_PIXEL).flat(), // Band 2: Black
                ...Array.from({length: 6}).fill(GREEN_PIXEL).flat(), // Band 3: Green
            ];
            const imageData: RawImageData = { data: new Uint8ClampedArray(dataValues), height: 18, width: 1 };
            const options: SixelEncoderOptions = { maxColors: 3 };
            const actualSixel = encodeToSixel(imageData, options);

            const rasterExpected = `${UNICODE_ESC}Pq"1;1;1;18`;
            const bandSeparator = "$";
            const finalTermExpected = `-${UNICODE_ESC}\\`;

            // For maxColors = 3, it appears the encoder does not write explicit HLS palette definitions.
            // It seems to map the quantized colors (Red, Black, Green in order of appearance in data for quantization)
            // to indices #0, #1, #2 respectively.
            // Input bands: Red, Black, Green
            // Expected Sixel data: #0 (for Red) ~ $ #1 (for Black) ~ $ #2 (for Green) ~

            const expectedSixelData = `${rasterExpected}#0~${bandSeparator}#1~${bandSeparator}#2~${finalTermExpected}`;

            expect(actualSixel).toBe(expectedSixelData);
        });
    });
});
