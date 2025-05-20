import { DCS, ST } from "../constants"; // Sixel introducer ESC P q, terminator ESC \
import { medianCutQuantize } from "./palette";
import type { RawImageData, SixelColor } from "./types";

// Sixel uses DCS (ESC P) + "q" + params + ST (ESC \)
const SIXEL_INTRODUCER = `${DCS}q`;

// Sixel characters are '?' (63) to '~' (126)
const SIXEL_CHAR_OFFSET = 63;

export interface SixelEncoderOptions {
    /** Maximum number of colors in the Sixel palette (e.g., 16, 256). Defaults to 256. */
    maxColors?: number;
    /** Override vertical image size (Pv) in Sixel raster attributes. Defaults to image data height. */
    overrideHeight?: number;
    /** Override horizontal image size (Ph) in Sixel raster attributes. Defaults to image data width. */
    overrideWidth?: number;
    /** Pixel aspect ratio denominator (Pasp). Defaults to 1. */
    pixelAspectRatioDenominator?: number;
    /** Pixel aspect ratio numerator (Pan). Defaults to 1. */
    pixelAspectRatioNumerator?: number;
}

/**
 * Encodes raw image data into a Sixel string.
 *
 * @param imageData The raw image data.
 * @param options Encoding options.
 * @returns A string representing the Sixel image.
 */
export function encodeToSixel(imageData: RawImageData, options?: SixelEncoderOptions): string {
    const maxColors = options?.maxColors ?? 256;

    // 1. Quantize image to get a palette
    const palette = medianCutQuantize(imageData, maxColors);
    if (palette.length === 0) return ""; // No colors, empty Sixel

    // Create a reverse map for quick palette index lookup
    const paletteIndexMap = new Map<string, number>();
    palette.forEach((color, index) => {
        const key = `${color.r}-${color.g}-${color.b}`;
        paletteIndexMap.set(key, index);
    });

    // Helper to find the closest color in the palette (Euclidean distance)
    const findClosestPaletteIndex = (r: number, g: number, b: number): number => {
        let minDistanceSq = Number.POSITIVE_INFINITY;
        let bestIndex = 0;
        for (const [index, pColor] of palette.entries()) {
            const dR = r - pColor.r;
            const dG = g - pColor.g;
            const dB = b - pColor.b;
            const distanceSq = dR * dR + dG * dG + dB * dB;
            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                bestIndex = index;
            }
            if (minDistanceSq === 0) break; // Exact match
        }
        return bestIndex;
    };

    let sixelString = SIXEL_INTRODUCER;

    // TODO: Add raster attributes if specified in options
    // Example: Pan; Hosp; Pv; Ph  (Aspect Numerator; Aspect Denominator; Vert Pixels; Horiz Pixels)
    // Common: "1;1;width;height
    if (imageData.width > 0 && imageData.height > 0) {
        const pan = options?.pixelAspectRatioNumerator ?? 1;
        const pasp = options?.pixelAspectRatioDenominator ?? 1;
        const ph = options?.overrideWidth ?? imageData.width;
        const pv = options?.overrideHeight ?? imageData.height;

        // Using " for raster attributes as per DEC STD 070 for DECGRA
        // Order Pan;Pasp;Ph;Pv (Aspect num, Aspect den, Width, Height)
        // This seems to match what Charmbracelet/libsixel uses too with Pasp first, then Ph, Pv.
        // DEC STD 070 Figure 10-2 for DECGRA shows "Pfn;Pan;Pasp;Ph;Pv". We omit Pfn.
        // XTerm manual cites "Pa;Pb;Ph;Pv" - Pa,Pb aspect ratio, Ph,Pv pixel dimensions.
        // Let's use Pan;Pasp;Ph;Pv (Aspect Numerator, Aspect Denominator, Horizontal size, Vertical size).
        sixelString += `"${pan};${pasp};${ph};${pv}`;
    }

    let currentSixelColorIndex = -1; // Tracks the active Sixel palette index, -1 initially
    let sixelRepeatChar = "\0";
    let sixelRepeatCount = 0;

    // Helper to flush pending repeat sequence
    const flushRepeat = () => {
        let data = "";
        if (sixelRepeatCount > 0) {
            if (sixelRepeatCount >= 3) {
                // Threshold for using repeat operator
                data += `!${sixelRepeatCount}${sixelRepeatChar}`;
            } else {
                for (let k = 0; k < sixelRepeatCount; k++) {
                    data += sixelRepeatChar;
                }
            }
            sixelRepeatChar = "\0";
            sixelRepeatCount = 0;
        }
        return data;
    };

    let previousSixelChars = ""; // To detect end of band for final line feed/CR

    for (let y = 0; y < imageData.height; y += 6) {
        let bandSixelData = "";
        currentSixelColorIndex = -1; // Reset color state at the start of each new band

        // At the start of a new band, the current color is undefined by Sixel spec,
        // but practically, we should set one. Let's not reset currentSixelColorIndex here
        // to allow color to persist across $ if possible, unless first char of band is different.

        for (let x = 0; x < imageData.width; x++) {
            // For this column, determine the required palette indices for its 6 pixels
            const columnPixelPaletteIndices: (number | null)[] = [];
            const uniquePaletteIndicesInColumn = new Set<number>();
            let hasVisiblePixel = false;

            for (let bit = 0; bit < 6; bit++) {
                const currentY = y + bit;
                if (currentY < imageData.height) {
                    const pixelOffset = (currentY * imageData.width + x) * 4;
                    const r = imageData.data[pixelOffset];
                    const g = imageData.data[pixelOffset + 1];
                    const b = imageData.data[pixelOffset + 2];
                    const pIndex = findClosestPaletteIndex(r, g, b);
                    columnPixelPaletteIndices.push(pIndex);
                    uniquePaletteIndicesInColumn.add(pIndex);
                    hasVisiblePixel = true;
                } else {
                    columnPixelPaletteIndices.push(null);
                }
            }

            if (!hasVisiblePixel && x < imageData.width - 1) {
                // Only skip if not the very last column with no data
                // If this column is entirely outside image height, it would effectively be all 'background'
                // for all colors. If currentSixelColorIndex is active, this means outputting '?’ for it.
                // We can optimize by only adding '?’ if it breaks a sequence or if truly needed.
                // For now, if a column has no data, treat it as a column of '?’ for current color.
                // This matches behavior if pixels were transparent and mapped to current color with 0 bits.
                if (currentSixelColorIndex !== -1) {
                    // if a color is active
                    if (sixelRepeatChar === String.fromCharCode(SIXEL_CHAR_OFFSET + 0) && sixelRepeatChar !== "\0") {
                        sixelRepeatCount++;
                    } else {
                        bandSixelData += flushRepeat();
                        sixelRepeatChar = String.fromCharCode(SIXEL_CHAR_OFFSET + 0);
                        sixelRepeatCount = 1;
                    }
                }
                continue;
            }

            // Iterate through unique palette indices found in this column
            // This simple model might switch colors many times. A better model picks a dominant color.
            // For now, let's process for each unique color that appears.
            // To make it more Sixel-like: iterate palette colors from 0 to N for this column.
            // This is closer to how some hardware might have worked or how libsixel generates.

            // Simplified: Process for a single color (e.g., most common, or just the first one active)
            // This requires a more complex lookahead or strategy. Let's stick to iterating active colors for now.

            // The most common approach is to iterate palette colors 0..N, and for each, generate the sixel pattern for the current column.
            // If the pattern is not empty (not '?'), then emit it (after setting color if needed).

            // For each palette color present in this column (can be optimized later)
            // Order of processing matters for optimal output. Processing in palette index order is standard.
            const sortedUniqueIndices = [...uniquePaletteIndicesInColumn].sort((a, b) => a - b);

            for (const targetPaletteIndex of sortedUniqueIndices) {
                let columnSixelPattern = 0;
                let hasTargetColorPixelInColumn = false;
                for (let bit = 0; bit < 6; bit++) {
                    if (columnPixelPaletteIndices[bit] === targetPaletteIndex) {
                        columnSixelPattern |= 1 << bit;
                        hasTargetColorPixelInColumn = true;
                    }
                }

                if (!hasTargetColorPixelInColumn && targetPaletteIndex !== currentSixelColorIndex) {
                    // If this palette color isn't even in the column, and it's not the active one,
                    // there's no sixel char to generate for it for this column.
                    continue;
                }
                // If it *is* the currentSixelColorIndex, but not in column, it implies '?’ for current color.

                // Now, check if we need to change color
                if (currentSixelColorIndex !== targetPaletteIndex) {
                    bandSixelData += flushRepeat();
                    bandSixelData += `#${targetPaletteIndex}`;
                    currentSixelColorIndex = targetPaletteIndex;
                }

                const sixelChar = String.fromCharCode(SIXEL_CHAR_OFFSET + columnSixelPattern);

                if (sixelChar === sixelRepeatChar && sixelRepeatChar !== "\0") {
                    sixelRepeatCount++;
                } else {
                    bandSixelData += flushRepeat();
                    sixelRepeatChar = sixelChar;
                    sixelRepeatCount = 1;
                }
            }
        }
        bandSixelData += flushRepeat(); // Flush any pending repeats at end of band
        sixelString += bandSixelData;

        if (bandSixelData.length > 0) {
            // Only add terminator if band had data
            previousSixelChars = bandSixelData;
            if (y + 6 < imageData.height) {
                sixelString += "$";
            }
        } else {
            // If an entire band had no sixel data generated for it (e.g., all transparent pixels
            // or pixels matching a background color that isn't explicitly drawn),
            // we still need to advance to the next band position if there are more bands to process.
            if (y + 6 < imageData.height) {
                sixelString += "$";
            }
        }
    }

    if (previousSixelChars !== "" && imageData.height > 0) {
        sixelString += "-";
    }

    sixelString += ST;
    return sixelString;
}
