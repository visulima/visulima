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

/**
 * Human-readable byte size: `B` under 1 KiB, then `KB` and `MB` to one decimal.
 *
 * A negative or non-finite size renders as an en dash rather than "NaN B",
 * which is what an asset the server could not stat reports.
 */
export const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return "–";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
