// Kitty keyboard protocol flags.
// @see https://sw.kovidgoyal.net/kitty/keyboard-protocol/
export const kittyFlags = {
    disambiguateEscapeCodes: 1,
    reportAllKeysAsEscapeCodes: 8,
    reportAlternateKeys: 4,
    reportAssociatedText: 16,
    reportEventTypes: 2,
} as const;

// Valid flag names for the kitty keyboard protocol.
export type KittyFlagName = keyof typeof kittyFlags;

// Converts an array of flag names to the corresponding bitmask value.
export function resolveFlags(flags: KittyFlagName[]): number {
    let result = 0;

    for (const flag of flags) {
        // eslint-disable-next-line no-bitwise
        result |= kittyFlags[flag];
    }

    return result;
}

// Kitty keyboard modifier bits.
// These are used in the modifier parameter of CSI u sequences.
// Note: The actual modifier value is (modifiers - 1) as per the protocol.
export const kittyModifiers = {
    alt: 2,
    capsLock: 64,
    ctrl: 4,
    hyper: 16,
    meta: 32,
    numLock: 128,
    shift: 1,
    super: 8,
} as const;

// Options for configuring kitty keyboard protocol.
export type KittyKeyboardOptions = {
    // Protocol flags to request from the terminal.
    // Pass an array of flag name strings.
    //
    // Available flags:
    // - 'disambiguateEscapeCodes' - Disambiguate escape codes (default)
    // - 'reportEventTypes' - Report key press, repeat, and release events
    // - 'reportAlternateKeys' - Report alternate key encodings
    // - 'reportAllKeysAsEscapeCodes' - Report all keys as escape codes
    // - 'reportAssociatedText' - Report associated text with key events
    flags?: KittyFlagName[];

    // Mode for kitty keyboard protocol support.
    // - 'auto': Attempt to detect terminal support (default)
    // - 'enabled': Force enable the protocol
    // - 'disabled': Never enable the protocol
    mode?: "auto" | "enabled" | "disabled";
};
