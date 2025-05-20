import { CSI, SEP } from "./constants";

/**
 * XTerm Key Modifier Options (XTMODKEYS).
 * Sets or resets XTerm key modifier resources.
 *
 * Sequence: `CSI > Pp m` (to reset resource Pp)
 * Sequence: `CSI > Pp ; Pv m` (to set resource Pp to value Pv)
 *
 * @param resource The resource parameter (Pp), a non-negative integer.
 * @param value Optional. The value parameter (Pv), a non-negative integer. If omitted, the resource is reset.
 *              If provided and not positive, it's treated as if omitted (resource is reset).
 * @returns The ANSI escape sequence.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-_-ordered-by-the-final-character_s_}
 */
export const keyModifierOptions = (resource: number, value?: number): string => {
    if (resource < 0) {
        return ""; // Resource must be non-negative
    }

    const pp = resource.toString();

    // XTerm documentation implies that if 'Pv' is omitted, the resource is reset.
    // If 'Pv' is provided (even 0), the resource is set to that value.
    if (value !== undefined) {
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
export const XTMODKEYS = keyModifierOptions;

/**
 * Sets an XTerm key modifier resource to a specific value.
 * This is a more explicit alias for `keyModifierOptions(resource, value)`.
 * @param resource The resource parameter (Pp).
 * @param value The value parameter (Pv).
 */
export function setKeyModifierOptions(resource: number, value: number): string {
    return keyModifierOptions(resource, value);
}

/**
 * Resets an XTerm key modifier resource to its initial value.
 * This is an alias for `keyModifierOptions(resource)`.
 * @param resource The resource parameter (Pp).
 */
export function resetKeyModifierOptions(resource: number): string {
    return keyModifierOptions(resource); // Omitting value causes a reset
}

/**
 * Query XTerm Key Modifier Options (XTQMODKEYS).
 * Requests the current setting of an XTerm key modifier resource.
 *
 * Sequence: `CSI ? Pp m`
 *
 * @param resource The resource parameter (Pp), a non-negative integer.
 * @returns The ANSI escape sequence.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-_-ordered-by-the-final-character_s_}
 */
export function queryKeyModifierOptions(resource: number): string {
    if (resource < 0) return ""; // Resource must be non-negative
    const pp = resource.toString();
    return `${CSI}?${pp}m`;
}

/** Alias for {@link queryKeyModifierOptions}. */
export const XTQMODKEYS = queryKeyModifierOptions;

// --- Modify Other Keys ---
// This relates to resource 4 of XTMODKEYS.
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
export const setModifyOtherKeys1 = `${CSI}>4;1m`;

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
export const setModifyOtherKeys2 = `${CSI}>4;2m`;

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
export const resetModifyOtherKeys = `${CSI}>4m`;

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
export const queryModifyOtherKeys = `${CSI}?4m`;

/**
 * Modifies XTerm "modifyOtherKeys" mode.
 * - `0`: Disable modifyOtherKeys mode. Prefer {@link resetModifyOtherKeys} or `setKeyModifierOptions(4, 0)`.
 * - `1`: Enable modifyOtherKeys mode 1. Prefer {@link setModifyOtherKeys1} or `setKeyModifierOptions(4, 1)`.
 * - `2`: Enable modifyOtherKeys mode 2. Prefer {@link setModifyOtherKeys2} or `setKeyModifierOptions(4, 2)`.
 *
 * Sequence: `CSI > 4 ; mode m`
 *
 * @param mode The mode to set (0, 1, or 2).
 * @returns The ANSI escape sequence.
 * @deprecated Prefer using {@link setModifyOtherKeys1}, {@link setModifyOtherKeys2}, {@link resetModifyOtherKeys}, or `setKeyModifierOptions(4, mode)` for clarity and better alignment with modern XTerm practices.
 * @example
 * ```typescript
 * import { modifyOtherKeys } from "@visulima/ansi";
 *
 * // Enable mode 1 (deprecated usage)
 * process.stdout.write(modifyOtherKeys(1)); // Sends: "\x1b[>4;1m"
 * ```
 */
export const modifyOtherKeys = (mode: 0 | 1 | 2): string => {
    return `${CSI}>4;${mode.toString()}m`;
};

/**
 * Disables the XTerm "modifyOtherKeys" mode.
 * Sequence: `CSI > 4 ; 0 m`
 * @deprecated Use {@link resetModifyOtherKeys} or call `setKeyModifierOptions(4, 0)` for better clarity and consistency.
 * The sequence `CSI > 4 m` ({@link resetModifyOtherKeys}) is generally preferred for resetting.
 * @example
 * ```typescript
 * import { disableModifyOtherKeys } from "@visulima/ansi";
 *
 * // Disable modifyOtherKeys (deprecated usage)
 * process.stdout.write(disableModifyOtherKeys); // Sends: "\x1b[>4;0m"
 * ```
 */
export const disableModifyOtherKeys = `${CSI}>4;0m`;

/**
 * Enables XTerm "modifyOtherKeys" mode 1.
 * Sequence: `CSI > 4 ; 1 m`
 * @deprecated Use the non-deprecated constant {@link setModifyOtherKeys1} or call `setKeyModifierOptions(4, 1)`.
 * @example
 * ```typescript
 * import { enableModifyOtherKeys1 } from "@visulima/ansi";
 *
 * // Enable modifyOtherKeys mode 1 (deprecated usage)
 * process.stdout.write(enableModifyOtherKeys1); // Sends: "\x1b[>4;1m"
 * ```
 */
export const enableModifyOtherKeys1: string = setModifyOtherKeys1;

/**
 * Enables XTerm "modifyOtherKeys" mode 2.
 * Sequence: `CSI > 4 ; 2 m`
 * @deprecated Use the non-deprecated constant {@link setModifyOtherKeys2} or call `setKeyModifierOptions(4, 2)`.
 * @example
 * ```typescript
 * import { enableModifyOtherKeys2 } from "@visulima/ansi";
 *
 * // Enable modifyOtherKeys mode 2 (deprecated usage)
 * process.stdout.write(enableModifyOtherKeys2); // Sends: "\x1b[>4;2m"
 * ```
 */
export const enableModifyOtherKeys2: string = setModifyOtherKeys2;

/**
 * Requests the XTerm "modifyOtherKeys" mode status.
 * Sequence: `CSI ? 4 m`
 * @deprecated Use the non-deprecated constant {@link queryModifyOtherKeys} or call `queryKeyModifierOptions(4)`.
 * @example
 * ```typescript
 * import { requestModifyOtherKeys } from "@visulima/ansi";
 *
 * // Query modifyOtherKeys status (deprecated usage)
 * process.stdout.write(requestModifyOtherKeys); // Sends: "\x1b[?4m"
 * ```
 */
export const requestModifyOtherKeys: string = queryModifyOtherKeys;
