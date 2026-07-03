/**
 * Clamps a value between min and max.
 */
export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * Returns true when the current browser is Safari.
 */
export const checkIsSafari = (): boolean => navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome");

/**
 * Converts a pixel string value to a number (e.g. "10px" becomes 10).
 */
export const pixelToNumber = (value: string | number): number => {
    if (typeof value === "string") {
        return value.endsWith("px") ? Number(value.slice(0, -2)) : Number(value);
    }

    return value;
};
