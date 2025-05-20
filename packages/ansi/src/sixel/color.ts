import type { SixelColor, SixelPalette } from "./types";

export interface DecodedSixelColorCommand {
    colorDefinition?: SixelColor; // If Pu, Px, Py, Pz are provided for RGB/HLS
    colorSpace?: "HLS" | "RGB"; // If Pu is present
    paletteIndex: number;
}

/**
 * Converts HSL color values to RGB.
 * Sixel HLS: H (0-360), L (0-100), S (0-100)
 * Output RGB: r, g, b (0-255)
 */
function hslToRgb(h: number, s: number, l: number): SixelColor {
    const sNormalized = s / 100;
    const lNormalized = l / 100;
    const hNormalized = (h % 360) / 360; // Normalize hue to 0-1, handling h >= 360

    let r: number;
    let g: number;
    let b: number;

    if (sNormalized === 0) {
        r = g = b = lNormalized; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number): number => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = lNormalized < 0.5 ? lNormalized * (1 + sNormalized) : lNormalized + sNormalized - lNormalized * sNormalized;
        const p = 2 * lNormalized - q;

        r = hue2rgb(p, q, hNormalized + 1 / 3);
        g = hue2rgb(p, q, hNormalized);
        b = hue2rgb(p, q, hNormalized - 1 / 3);
    }

    return {
        b: Math.round(b * 255),
        g: Math.round(g * 255),
        r: Math.round(r * 255),
    };
}

/**
 * Parses a Sixel color command string (e.g., "#1", "#1;2;100;50;50").
 * Advances the position in the SixelData string within the decoder instance.
 *
 * @param sixelData The full Sixel data string.
 * @param currentPosition The current parsing position in sixelData (points to '#').
 * @returns An object with the decoded color command and the number of characters consumed, or null if invalid.
 */
export function decodeSixelColor(sixelData: string, currentPosition: number): { cmd: DecodedSixelColorCommand; consumed: number } | null {
    let pos = currentPosition;
    if (sixelData[pos] !== "#") return null;
    pos++; // Consume '#'

    const parameters: number[] = [];
    let currentParameter = "";

    // Allow optional leading sign for parameters
    let sign = 1;

    while (pos < sixelData.length) {
        const char = sixelData[pos];
        if (char === "-" && currentParameter === "") {
            sign = -1;
            pos++;
            // continue; // ensure next char is digit or break
        } else if (char === "+" && currentParameter === "") {
            sign = 1;
            pos++;
            // continue;
        } else if (char >= "0" && char <= "9") {
            currentParameter += char;
            pos++;
        } else if (char === ";") {
            if (currentParameter === "" && sign === 1) {
                // only sign, no digits like in "#1;+;1"
                parameters.push(Number.NaN); // Treat as invalid param
            } else {
                parameters.push(sign * Number.parseInt(currentParameter, 10));
            }
            currentParameter = "";
            sign = 1; // Reset sign for next parameter
            pos++;
        } else {
            // End of color command (e.g., next is Sixel data char, !, -, $)
            break;
        }
    }
    if (currentParameter) {
        parameters.push(sign * Number.parseInt(currentParameter, 10));
    }

    if (parameters.length === 0 || isNaN(parameters[0])) return null;

    const paletteIndex = parameters[0];
    const result: DecodedSixelColorCommand = { paletteIndex };

    if (parameters.length >= 2 && !isNaN(parameters[1])) {
        const pu = parameters[1];
        if ((pu === 1 || pu === 2) && parameters.length === 5) {
            // HLS (1) or RGB (2) with all 3 components
            const p1 = parameters[2]; // H or R
            const p2 = parameters[3]; // L or G
            const p3 = parameters[4]; // S or B
            if ([p1, p2, p3].some(isNaN)) return null; // Invalid sub-param

            result.colorSpace = pu === 1 ? "HLS" : "RGB";
            if (result.colorSpace === "RGB") {
                // Clamp RGB components (Px, Py, Pz) to 0-100 range
                const r100 = Math.max(0, Math.min(100, p1));
                const g100 = Math.max(0, Math.min(100, p2));
                const b100 = Math.max(0, Math.min(100, p3));
                result.colorDefinition = {
                    b: Math.max(0, Math.min(255, Math.floor((b100 * 255 + 50) / 100))),
                    g: Math.max(0, Math.min(255, Math.floor((g100 * 255 + 50) / 100))),
                    // Scale 0-100 to 0-255, ensuring .5 rounds up consistently
                    r: Math.max(0, Math.min(255, Math.floor((r100 * 255 + 50) / 100))),
                };
            } else {
                // HLS
                // Clamp HLS components: H (0-360), L (0-100), S (0-100)
                const h360 = Math.max(0, Math.min(360, p1));
                const l100 = Math.max(0, Math.min(100, p2));
                const s100 = Math.max(0, Math.min(100, p3));
                // P1: Hue (0-360), P2: Lightness (0-100), P3: Saturation (0-100)
                result.colorDefinition = hslToRgb(h360, s100, l100); // Note: Sixel P2 is L, P3 is S
            }
        }
    }

    return { cmd: result, consumed: pos - currentPosition };
}

/**
 * Updates a palette with a new color definition.
 * @param palette The palette to update.
 * @param paletteIndex The index to update.
 * @param colorDef The color to set.
 */
export function updatePalette(palette: SixelPalette, paletteIndex: number, colorDef: SixelColor): void {
    if (paletteIndex >= 0 && paletteIndex < palette.maxSize) {
        palette.colors[paletteIndex] = colorDef;
    }
}

export const SIXEL_STANDARD_PALETTE_SIZE = 16;

// Standard 16-color Sixel palette (approximations)
// Based on typical VT340 default palette
export const DEFAULT_SIXEL_COLORS: ReadonlyArray<SixelColor> = Object.freeze([
    { b: 0, g: 0, r: 0 }, // 0: Black
    { b: 170, g: 0, r: 0 }, // 1: Blue (approx for 20% blue)
    { b: 0, g: 0, r: 170 }, // 2: Red (approx for 20% red)
    { b: 0, g: 170, r: 0 }, // 3: Green (approx for 20% green)
    { b: 170, g: 0, r: 170 }, // 4: Magenta (approx for 20% magenta)
    { b: 170, g: 170, r: 0 }, // 5: Cyan (approx for 20% cyan)
    { b: 0, g: 170, r: 170 }, // 6: Yellow (approx for 20% yellow)
    { b: 170, g: 170, r: 170 }, // 7: Gray 50% (approx for 53% gray)
    { b: 85, g: 85, r: 85 }, // 8: Gray 25% (approx for 26% gray)
    { b: 255, g: 85, r: 85 }, // 9: Bright Blue (approx for 40% blue)
    { b: 85, g: 85, r: 255 }, // 10: Bright Red
    { b: 85, g: 255, r: 85 }, // 11: Bright Green
    { b: 255, g: 85, r: 255 }, // 12: Bright Magenta
    { b: 255, g: 255, r: 85 }, // 13: Bright Cyan
    { b: 85, g: 255, r: 255 }, // 14: Bright Yellow
    { b: 255, g: 255, r: 255 }, // 15: White
]);

export function createInitialSixelPalette(): SixelPalette {
    return {
        colors: [...DEFAULT_SIXEL_COLORS], // Create a mutable copy
        // maxSize: SIXEL_STANDARD_PALETTE_SIZE, // Initially, the palette can only hold these standard colors.
        // It might be expandable later via private color definitions up to a larger max (e.g. 256)
        // For now, let's assume maxSize refers to the currently addressable size via #Pn.
        // If Sixel allows defining colors beyond index 15, maxSize should be larger (e.g., 256)
        // and colors array should be pre-filled or growable.
        // Let's set maxSize to 256, common max for Sixel.
        maxSize: 256,
        // And fill the rest of the colors up to maxSize with black or a default.
        // Or, more efficiently, let `colors` array grow as needed. For now, just copy defaults.
    };
}

// Re-export types for convenience if SixelDecoder imports primarily from color.ts

export { type SixelColor, type SixelPalette } from "./types";
