import { describe, expect, it } from "vitest";

import { medianCutQuantize } from "../../src/sixel/palette";
import type { RawImageData } from "../../src/sixel/types";

const createMockImageData = function (pixels: [number, number, number, number][], width: number, height: number): RawImageData {
    const data = new Uint8ClampedArray(pixels.flat());
    return { data, height, width };
};

describe("medianCutQuantize", () => {
    it("should return empty array for maxColors <= 0", () => {
        const imageData = createMockImageData([[0, 0, 0, 255]], 1, 1);
        expect(medianCutQuantize(imageData, 0)).toEqual([]);
        expect(medianCutQuantize(imageData, -1)).toEqual([]);
    });

    it("should return empty array for empty image data", () => {
        const imageData = createMockImageData([], 0, 0);
        expect(medianCutQuantize(imageData, 16)).toEqual([]);
    });

    it("should return unique colors if their count is <= maxColors", () => {
        const pixels: [number, number, number, number][] = [
            [255, 0, 0, 255], // Red
            [0, 255, 0, 255], // Green
        ];
        const imageData = createMockImageData(pixels, 2, 1);
        const palette = medianCutQuantize(imageData, 2);
        expect(palette).toHaveLength(2);
        expect(palette).toContainEqual({ b: 0, g: 0, r: 255 });
        expect(palette).toContainEqual({ b: 0, g: 255, r: 0 });

        const palette3 = medianCutQuantize(imageData, 3);
        expect(palette3).toHaveLength(2); // Still 2 unique colors
    });

    it("should return exactly maxColors unique colors if input has exactly maxColors", () => {
        const pixels: [number, number, number, number][] = [
            [255, 0, 0, 255], // Red
            [0, 255, 0, 255], // Green
            [0, 0, 255, 255], // Blue
        ];
        const imageData = createMockImageData(pixels, 3, 1);
        const palette = medianCutQuantize(imageData, 3);
        expect(palette).toHaveLength(3);
        expect(palette).toContainEqual({ b: 0, g: 0, r: 255 });
        expect(palette).toContainEqual({ b: 0, g: 255, r: 0 });
        expect(palette).toContainEqual({ b: 255, g: 0, r: 0 });
    });

    it("should quantize to maxColors when unique colors > maxColors", () => {
        const pixels: [number, number, number, number][] = [
            [250, 0, 0, 255], // Dark Red (many)
            [250, 0, 0, 255],
            [250, 0, 0, 255],
            [0, 250, 0, 255], // Dark Green (many)
            [0, 250, 0, 255],
            [0, 250, 0, 255],
            [5, 5, 5, 255], // Near Black (few)
            [245, 245, 245, 255], // Near White (few)
        ];
        const imageData = createMockImageData(pixels, pixels.length, 1);
        const palette = medianCutQuantize(imageData, 2);
        expect(palette).toHaveLength(2);
        // Expect colors to be averages of the dominant groups
        // The exact values depend on the median cut logic, but they should be representative.
        // One color should be close to dark red, the other close to dark green.
        const hasReddish = palette.some((c) => c.r > 150 && c.g < 100 && c.b < 100);
        const hasGreenish = palette.some((c) => c.r < 100 && c.g > 150 && c.b < 100);
        expect(hasReddish).toBeTruthy();
        expect(hasGreenish).toBeTruthy();
    });

    it("should handle maxColors = 1 (average of all colors)", () => {
        const pixels: [number, number, number, number][] = [
            [255, 0, 0, 255], // Red
            [0, 0, 255, 255], // Blue
        ];
        const imageData = createMockImageData(pixels, 2, 1);
        const palette = medianCutQuantize(imageData, 1);
        expect(palette).toHaveLength(1);
        if (palette.length > 0 && palette[0]) {
            expect(palette[0].r).toBe(128); // Math.round((255+0)/2)
            expect(palette[0].g).toBe(0);
            expect(palette[0].b).toBe(128); // Math.round((0+255)/2)
        }
    });

    it("should handle an image with uniform color", () => {
        const pixels: [number, number, number, number][] = [
            [100, 150, 200, 255],
            [100, 150, 200, 255],
            [100, 150, 200, 255],
            [100, 150, 200, 255],
        ];
        const imageData = createMockImageData(pixels, 2, 2);
        const palette = medianCutQuantize(imageData, 4); // Request more colors than unique
        expect(palette).toHaveLength(1);
        if (palette.length > 0 && palette[0]) {
            expect(palette[0]).toEqual({ b: 200, g: 150, r: 100 });
        }
    });

    it("should handle a grayscale image quantization", () => {
        const pixels: [number, number, number, number][] = [
            [10, 10, 10, 255], // Dark gray
            [10, 10, 10, 255],
            [100, 100, 100, 255], // Medium gray
            [200, 200, 200, 255], // Light gray
            [200, 200, 200, 255],
        ];
        const imageData = createMockImageData(pixels, pixels.length, 1);
        const palette = medianCutQuantize(imageData, 2);
        expect(palette).toHaveLength(2);
        // Check if one color is darkish and one is lightish gray
        const hasDarkGray = palette.some((c) => c.r < 80 && c.g < 80 && c.b < 80);
        const hasLightGray = palette.some((c) => c.r > 150 && c.g > 150 && c.b > 150);
        expect(hasDarkGray).toBeTruthy();
        expect(hasLightGray).toBeTruthy();
    });

    it("should prioritize splitting the largest dimension (range of color values)", () => {
        // R has large range (0-250), G and B have small ranges
        const pixels: [number, number, number, number][] = [
            [0, 10, 20, 255],
            [5, 11, 21, 255],
            [245, 10, 20, 255],
            [250, 11, 21, 255],
        ];
        const imageData = createMockImageData(pixels, 4, 1);
        const palette = medianCutQuantize(imageData, 2);
        expect(palette).toHaveLength(2);
        if (palette.length >= 2 && palette[0] && palette[1]) {
            const p1 = palette[0];
            const p2 = palette[1];
            expect(Math.abs(p1.r - p2.r)).toBeGreaterThan(100);
            expect(Math.abs(p1.g - p2.g)).toBeLessThan(5); // G values should be close
            expect(Math.abs(p1.b - p2.b)).toBeLessThan(5); // B values should be close
        }
    });

    it("should correctly average colors in final cubes", () => {
        // Create an image with two distinct color groups that will form the final cubes
        const pixels: [number, number, number, number][] = [
            // Group 1 (Dark Red)
            [10, 0, 0, 255],
            [20, 0, 0, 255],
            // Group 2 (Light Blue)
            [200, 220, 255, 255],
            [210, 230, 250, 255],
        ];
        const imageData = createMockImageData(pixels, pixels.length, 1);
        const palette = medianCutQuantize(imageData, 2);
        expect(palette).toHaveLength(2);

        const avgRed = { b: 0, g: 0, r: (10 + 20) / 2 }; // 15,0,0
        const avgBlue = { b: (255 + 250) / 2, g: (220 + 230) / 2, r: (200 + 210) / 2 }; // 205, 225, 252.5

        // Check if one palette color is close to avgRed and the other to avgBlue
        const foundRed = palette.some((c) => Math.abs(c.r - avgRed.r) < 2 && Math.abs(c.g - avgRed.g) < 2 && Math.abs(c.b - avgRed.b) < 2);
        const foundBlue = palette.some((c) => Math.abs(c.r - avgBlue.r) < 2 && Math.abs(c.g - avgBlue.g) < 2 && Math.abs(c.b - avgBlue.b) < 2);
        expect(foundRed).toBeTruthy();
        expect(foundBlue).toBeTruthy();
    });

    it("should handle an image where all pixels are identical", () => {
        const pixels: [number, number, number, number][] = new Array(100).fill([50, 100, 150, 255]);
        const imageData = createMockImageData(pixels, 10, 10);
        const palette = medianCutQuantize(imageData, 4);
        expect(palette).toHaveLength(1);
        if (palette.length > 0 && palette[0]) {
            expect(palette[0]).toEqual({ b: 150, g: 100, r: 50 });
        }
    });

    it("should handle image with alpha (alpha is currently ignored in keying and averaging)", () => {
        const pixels: [number, number, number, number][] = [
            [255, 0, 0, 255], // Red, opaque
            [255, 0, 0, 128], // Red, semi-transparent
            [0, 255, 0, 255], // Green, opaque
        ];
        const imageData = createMockImageData(pixels, 3, 1);
        // Quantize to 2 colors. Expect red and green, alpha ignored.
        const palette = medianCutQuantize(imageData, 2);
        expect(palette).toHaveLength(2);
        expect(palette).toContainEqual({ b: 0, g: 0, r: 255 });
        expect(palette).toContainEqual({ b: 0, g: 255, r: 0 });
    });
});
