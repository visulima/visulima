/**
 * Color matrix transforms for color blindness simulation and compensation.
 *
 * Matrices sourced from research by Brettel, Viénot, and Mollon (1997)
 * and Machado, Oliveira, and Fernandes (2009).
 *
 * @see https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
 */

/**
 * 3x3 color transformation matrix operating on linear RGB values (0-255).
 */
export type ColorMatrix = readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
];

export type ColorBlindnessType = "achromatopsia" | "deuteranopia" | "protanopia" | "tritanopia";

/**
 * Simulation matrices — show how colors appear to users with color vision deficiency.
 */
export const COLOR_BLINDNESS_SIMULATION: Record<ColorBlindnessType, ColorMatrix> = {
    // Protanopia (red-blind, ~1% of males)
    protanopia: [
        [0.567, 0.433, 0.000],
        [0.558, 0.442, 0.000],
        [0.000, 0.242, 0.758],
    ],
    // Deuteranopia (green-blind, ~1% of males)
    deuteranopia: [
        [0.625, 0.375, 0.000],
        [0.700, 0.300, 0.000],
        [0.000, 0.300, 0.700],
    ],
    // Tritanopia (blue-blind, ~0.003% of population)
    tritanopia: [
        [0.950, 0.050, 0.000],
        [0.000, 0.433, 0.567],
        [0.000, 0.475, 0.525],
    ],
    // Achromatopsia (total color blindness, rod monochromacy)
    achromatopsia: [
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
    ],
};

/**
 * Compensation matrices — shift colors into a distinguishable range for affected users.
 * These remap problematic colors to alternatives the user can perceive.
 */
/**
 * Compensation matrices — enhance distinguishability for affected users
 * by redistributing the lost channel's energy into perceivable channels.
 * Based on Daltonization approach (Fidaner et al., 2005).
 */
export const COLOR_BLINDNESS_COMPENSATION: Record<Exclude<ColorBlindnessType, "achromatopsia">, ColorMatrix> = {
    // Protanopia: redistribute lost red info into green and blue
    protanopia: [
        [1.000, 0.000, 0.000],
        [0.700, 1.000, 0.000],
        [0.700, 0.000, 1.000],
    ],
    // Deuteranopia: redistribute lost green info into red and blue
    deuteranopia: [
        [1.000, 0.700, 0.000],
        [0.000, 1.000, 0.000],
        [0.000, 0.700, 1.000],
    ],
    // Tritanopia: redistribute lost blue info into red and green
    tritanopia: [
        [1.000, 0.000, 0.700],
        [0.000, 1.000, 0.700],
        [0.000, 0.000, 1.000],
    ],
};

/**
 * Identity matrix (no transformation).
 */
export const IDENTITY_MATRIX: ColorMatrix = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
];

const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

/**
 * Apply a 3x3 color matrix to an RGB triplet.
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @param matrix - The 3x3 transformation matrix
 * @returns Transformed [r, g, b] triplet, clamped to 0-255
 */
export const applyColorMatrix = (r: number, g: number, b: number, matrix: ColorMatrix): [number, number, number] => [
    clamp(matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b),
    clamp(matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b),
    clamp(matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b),
];

/**
 * Parse a hex color string to RGB components.
 */
export const hexToRgb = (hex: string): [number, number, number] | null => {
    // 6-digit hex
    const match6 = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);

    if (match6) {
        return [
            Number.parseInt(match6[1]!, 16),
            Number.parseInt(match6[2]!, 16),
            Number.parseInt(match6[3]!, 16),
        ];
    }

    // 3-digit shorthand hex (#f80 → #ff8800)
    const match3 = /^#?([\da-f])([\da-f])([\da-f])$/i.exec(hex);

    if (match3) {
        return [
            Number.parseInt(match3[1]! + match3[1]!, 16),
            Number.parseInt(match3[2]! + match3[2]!, 16),
            Number.parseInt(match3[3]! + match3[3]!, 16),
        ];
    }

    return null;
};

/**
 * Convert RGB components to a hex color string.
 */
export const rgbToHex = (r: number, g: number, b: number): string =>
    `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;

/**
 * Transform a hex color through a color blindness simulation or compensation matrix.
 * Returns the original color if parsing fails.
 */
export const transformHexColor = (hex: string, matrix: ColorMatrix): string => {
    const rgb = hexToRgb(hex);

    if (!rgb) {
        return hex;
    }

    const [r, g, b] = applyColorMatrix(rgb[0], rgb[1], rgb[2], matrix);

    return rgbToHex(r, g, b);
};
