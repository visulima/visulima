import { CSI } from "./constants";

/**
 * XTerm Key Modifier Options (XTMODKEYS).
 * Sets or resets XTerm key modifier resources.
 *
 * Sequence: `CSI > Pp m` (to reset resource Pp).
 * Sequence: `CSI > Pp ; Pv m` (to set resource Pp to value Pv).
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

// --- Kitty keyboard protocol (progressive enhancement) ---
// Modern terminals (kitty, ghostty, foot, WezTerm, …) expose an opt-in keyboard
// protocol that disambiguates modifiers and reports key-release events. Flags
// are pushed onto a per-terminal stack so a TUI can enable them on entry and
// restore the previous state on exit.
// See: https://sw.kovidgoyal.net/kitty/keyboard-protocol/

/**
 * Bit flags for the Kitty keyboard protocol progressive-enhancement level.
 *
 * Combine members with bitwise OR to request multiple enhancements at once.
 * @see {@link https://sw.kovidgoyal.net/kitty/keyboard-protocol/#progressive-enhancement}
 */
export const KittyKeyboardFlag = {
    /** Disambiguate escape codes so modifier+key combos are unambiguous. */
    DisambiguateEscapeCodes: 1,
    /** Report all keys as escape codes (so e.g. Enter/Tab/Backspace are reported uniformly). */
    ReportAllKeysAsEscapeCodes: 16,
    /** Report alternate keys (e.g. shifted layout keys and the base layout key). */
    ReportAlternateKeys: 8,
    /** Embed the text the key would produce in the escape code. */
    ReportAssociatedText: 4,
    /** Add event-type data, enabling key-release (and repeat) reporting. */
    ReportEventTypes: 2,
} as const;

/**
 * A Kitty keyboard protocol flag value: a bitwise OR of {@link KittyKeyboardFlag}
 * members (range `0`-`31`).
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type KittyKeyboardFlags = number;

/**
 * Pushes a new set of Kitty keyboard protocol flags onto the terminal's stack.
 *
 * Sequence: `CSI > flags u`
 * @param flags Bitwise OR of {@link KittyKeyboardFlag} values. Defaults to {@link KittyKeyboardFlag.DisambiguateEscapeCodes}.
 * @returns The escape sequence enabling the requested enhancement level.
 * @example
 * ```typescript
 * import { pushKittyKeyboard, KittyKeyboardFlag as Flag } from "@visulima/ansi/xterm";
 *
 * const flags = Flag.DisambiguateEscapeCodes | Flag.ReportEventTypes;
 *
 * process.stdout.write(pushKittyKeyboard(flags));
 * ```
 * @see {@link https://sw.kovidgoyal.net/kitty/keyboard-protocol/#progressive-enhancement}
 */
export const pushKittyKeyboard = (flags: KittyKeyboardFlags = KittyKeyboardFlag.DisambiguateEscapeCodes): string =>
    `${CSI}>${(Number.isInteger(flags) && flags >= 0 ? flags : 0).toString()}u`;

/**
 * Pops one or more entries from the terminal's Kitty keyboard protocol flag stack,
 * restoring the previous enhancement level. Call this on exit to undo {@link pushKittyKeyboard}.
 *
 * Sequence: `CSI < number u`
 * @param count How many stack entries to pop. Defaults to `1`.
 * @returns The escape sequence popping the stack.
 * @example
 * ```typescript
 * import { popKittyKeyboard } from "@visulima/ansi/xterm";
 *
 * process.stdout.write(popKittyKeyboard());
 * ```
 * @see {@link https://sw.kovidgoyal.net/kitty/keyboard-protocol/#progressive-enhancement}
 */
export const popKittyKeyboard = (count = 1): string => `${CSI}<${(Number.isInteger(count) && count > 0 ? count : 1).toString()}u`;

/**
 * Sets the Kitty keyboard protocol flags, replacing the current top-of-stack
 * entry (mode `1`) rather than pushing a new one.
 *
 * Sequence: `CSI = flags ; 1 u`
 * @param flags Bitwise OR of {@link KittyKeyboardFlag} values.
 * @returns The escape sequence setting the flags.
 * @see {@link https://sw.kovidgoyal.net/kitty/keyboard-protocol/#progressive-enhancement}
 */
export const setKittyKeyboard = (flags: KittyKeyboardFlags = KittyKeyboardFlag.DisambiguateEscapeCodes): string =>
    `${CSI}=${(Number.isInteger(flags) && flags >= 0 ? flags : 0).toString()};1u`;

/**
 * Queries the terminal's current Kitty keyboard protocol flags.
 *
 * Sequence: `CSI ? u`
 * Response: `CSI ? flags u`.
 * @returns The query escape sequence.
 * @example
 * ```typescript
 * import { queryKittyKeyboard } from "@visulima/ansi/xterm";
 *
 * process.stdout.write(queryKittyKeyboard);
 * // Expect a response like: "\x1b[?1u"
 * ```
 * @see {@link https://sw.kovidgoyal.net/kitty/keyboard-protocol/#progressive-enhancement}
 */
export const queryKittyKeyboard: string = `${CSI}?u`;
