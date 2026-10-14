/**
 * Offsets are terminal cell coordinates: truncate toward zero and treat anything that is not a finite number as 0.
 */
export const toCellOffset = (value: unknown): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }

    return Math.trunc(value);
};
