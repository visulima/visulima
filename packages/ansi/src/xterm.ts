import { CSI } from "./constants";

/**
 * XTerm Key Modifier Options XTMODKEYS.
 * Sets or resets XTerm key modifier resources.
 *
 * Sequence: `CSI > Pp m` (to reset resource Pp)
 * Sequence: `CSI > Pp ; Pv m` (to set resource Pp to value Pv)
 * @param resource The resource parameter (Pp), a non-negative integer.
 * @param value Optional. The value parameter (Pv), a non-negative integer. If omitted, the resource is reset.
 * If provided and not positive, it's treated as if omitted (resource is reset).
 * @returns The ANSI escape sequence.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-_-ordered-by-the-final-character_s_}
 */
export const keyModifierOptions = (resource: number, value?: number): string => {
    if (resource < 0 || !Number.isInteger(resource)) {
        return ""; // Resource must be a non-negative integer
    }

    const pp = resource.toString();

    // XTerm documentation implies that if 'Pv' is omitted, the resource is reset.
    // If 'Pv' is provided (even 0), the resource is set to that value.
    if (value !== undefined) {
        if (!Number.isInteger(value)) {
            return ""; // Value must be an integer
        }

        const pv = value.toString();

        return `${CSI}>${pp};${pv}m`;
    }

    // Reset: value is undefined
    return `${CSI}>${pp}m`;
};

/**
 * Alias for {@link keyModifierOptions}.
 * Provides a shorthand for setting or resetting XTerm key modifier resources.
 * @see keyModifierOptions
 */
export const XTMODKEYS: (resource: number, value?: number) => string = keyModifierOptions;

/**
 * Query XTerm Key Modifier Options (XTQMODKEYS).
 * Requests the current setting of an XTerm key modifier resource.
 *
 * Sequence: `CSI ? Pp m`
 * @param resource The resource parameter (Pp), a non-negative integer.
 * @returns The ANSI escape sequence.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-_-ordered-by-the-final-character_s_}
 */
export const queryKeyModifierOptions = (resource: number): string => {
    if (resource < 0 || !Number.isInteger(resource)) {
        return ""; // Resource must be a non-negative integer
    }

    const pp = resource.toString();

    return `${CSI}?${pp}m`;
};

/**
 * Resets an XTerm key modifier resource to its initial value.
 * This is an alias for `keyModifierOptions(resource)`.
 * @param resource The resource parameter (Pp).
 */
export const resetKeyModifierOptions = (resource: number): string => keyModifierOptions(resource); // Omitting value causes a reset

/**
 * Sets an XTerm key modifier resource to a specific value.
 * This is a more explicit alias for `keyModifierOptions(resource, value)`.
 * @param resource The resource parameter (Pp).
 * @param value The value parameter (Pv).
 */
export const setKeyModifierOptions = (resource: number, value: number): string => keyModifierOptions(resource, value);

/** Alias for {@link queryKeyModifierOptions}. */
export const XTQMODKEYS: (resource: number) => string = queryKeyModifierOptions;

// --- Modify Other Keys ---
// This relates to resource 4 of XTMODKEYS.
// eslint-disable-next-line no-secrets/no-secrets
// See: https://invisible-island.net/xterm/manpage/xterm.html#VT100-Widget-Resources:modifyOtherKeys

/**
 * Set XTerm "modifyOtherKeys" mode to mode 1 (sends modified escape sequences for certain keys).
 * Sequence: `CSI > 4 ; 1 m`
 * @example
 * ```typescript
 * import { setModifyOtherKeys1 } from "@visulima/ansi";
 *
 * process.stdout.write(setModifyOtherKeys1);
 * // Sends: "\x1b[>4;1m"
 * ```
 */
export const setModifyOtherKeys1: string = `${CSI}>4;1m`;

/**
 * Set XTerm "modifyOtherKeys" mode to mode 2 (alternative modified escape sequences).
 * Sequence: `CSI > 4 ; 2 m`
 * @example
 * ```typescript
 * import { setModifyOtherKeys2 } from "@visulima/ansi";
 *
 * process.stdout.write(setModifyOtherKeys2);
 * // Sends: "\x1b[>4;2m"
 * ```
 */
export const setModifyOtherKeys2: string = `${CSI}>4;2m`;

/**
 * Reset XTerm "modifyOtherKeys" to its default behavior (mode 0 or initial value).
 * Sequence: `CSI > 4 m` (This effectively sets resource 4, value 0, or resets resource 4).
 * @example
 * ```typescript
 * import { resetModifyOtherKeys } from "@visulima/ansi";
 *
 * process.stdout.write(resetModifyOtherKeys);
 * // Sends: "\x1b[>4m"
 * ```
 */
export const resetModifyOtherKeys: string = `${CSI}>4m`;

/**
 * Query the current XTerm "modifyOtherKeys" mode.
 * Sequence: `CSI ? 4 m`
 * Response: `CSI > 4 ; Ps m` where Ps is 0, 1, or 2.
 * @example
 * ```typescript
 * import { queryModifyOtherKeys } from "@visulima/ansi";
 *
 * process.stdout.write(queryModifyOtherKeys);
 * // Sends: "\x1b[?4m"
 * // Expect a response like: "\x1b[>4;1m" if mode 1 is set.
 * ```
 */
export const queryModifyOtherKeys: string = `${CSI}?4m`;
