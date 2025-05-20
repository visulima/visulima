import { CSI } from "./constants";

/**
 * Represents the reported setting of a terminal mode, typically received in response to a DECRQM (Request Mode) query.
 * The terminal responds with a DECRPM (Report Mode) sequence containing one of these values.
 *
 * @see {@link requestMode} (DECRQM) for how to query a mode's state.
 * @see {@link reportMode} (DECRPM) for how a terminal might report these states.
 * @see {@link https://vt100.net/docs/vt510-rm/DECRPM.html} VT510 DECRPM Documentation.
 * @enum {number}
 */
export enum ModeSetting {
    /**
     * Mode is not recognized by the terminal.
     * This indicates that the terminal does not support or understand the queried mode number.
     * (Parameter `Ps = 0` in DECRPM)
     */
    NotRecognized = 0,
    /**
     * Mode is currently set.
     * (Parameter `Ps = 1` in DECRPM)
     */
    Set = 1,
    /**
     * Mode is currently reset (not set).
     * (Parameter `Ps = 2` in DECRPM)
     */
    Reset = 2,
    /**
     * Mode is permanently set and cannot be changed (e.g., by RM or SM sequences).
     * (Parameter `Ps = 3` in DECRPM)
     */
    PermanentlySet = 3,
    /**
     * Mode is permanently reset and cannot be changed (e.g., by RM or SM sequences).
     * (Parameter `Ps = 4` in DECRPM)
     */
    PermanentlyReset = 4,
}

/**
 * Checks if the reported mode setting indicates that the mode is not recognized by the terminal.
 *
 * @param m - The `ModeSetting` value reported by the terminal.
 * @returns `true` if the mode is {@link ModeSetting.NotRecognized}, `false` otherwise.
 */
export const isModeNotRecognized = (m: ModeSetting): boolean => {
    return m === ModeSetting.NotRecognized;
};

/**
 * Checks if the reported mode setting indicates that the mode is currently set or permanently set.
 *
 * @param m - The `ModeSetting` value reported by the terminal.
 * @returns `true` if the mode is {@link ModeSetting.Set} or {@link ModeSetting.PermanentlySet}, `false` otherwise.
 */
export const isModeSet = (m: ModeSetting): boolean => {
    return m === ModeSetting.Set || m === ModeSetting.PermanentlySet;
};

/**
 * Checks if the reported mode setting indicates that the mode is currently reset or permanently reset.
 *
 * @param m - The `ModeSetting` value reported by the terminal.
 * @returns `true` if the mode is {@link ModeSetting.Reset} or {@link ModeSetting.PermanentlyReset}, `false` otherwise.
 */
export const isModeReset = (m: ModeSetting): boolean => {
    return m === ModeSetting.Reset || m === ModeSetting.PermanentlyReset;
};

/**
 * Checks if the reported mode setting indicates that the mode is permanently set and cannot be changed.
 *
 * @param m - The `ModeSetting` value reported by the terminal.
 * @returns `true` if the mode is {@link ModeSetting.PermanentlySet}, `false` otherwise.
 */
export const isModePermanentlySet = (m: ModeSetting): boolean => {
    return m === ModeSetting.PermanentlySet;
};

/**
 * Checks if the reported mode setting indicates that the mode is permanently reset and cannot be changed.
 *
 * @param m - The `ModeSetting` value reported by the terminal.
 * @returns `true` if the mode is {@link ModeSetting.PermanentlyReset}, `false` otherwise.
 */
export const isModePermanentlyReset = (m: ModeSetting): boolean => {
    return m === ModeSetting.PermanentlyReset;
};

/**
 * Interface representing a terminal mode, characterized by its numeric code
 * and whether it's a standard ANSI mode or a private DEC mode.
 *
 * - Standard ANSI modes are controlled by `CSI Pn h` (Set Mode - SM) and `CSI Pn l` (Reset Mode - RM).
 * - Private DEC modes are controlled by `CSI ? Pn h` (DECSET) and `CSI ? Pn l` (DECRST).
 */
export interface Mode {
    /** The numeric code of the terminal mode (e.g., `4` for Insert/Replace Mode, `25` for Text Cursor Enable Mode). */
    readonly code: number;
    /**
     * Indicates if this is a private DEC mode.
     * - `true`: It's a DEC mode (sequence uses `?`, e.g., `CSI ?25h`).
     * - `false`: It's a standard ANSI mode (sequence does not use `?`, e.g., `CSI 4h`).
     */
    readonly isDecMode: boolean;
}

/**
 * Abstract base class for representing an ANSI terminal mode.
 * Ensures that `isDecMode` is `false`.
 * @internal We don't export this directly; use {@link createAnsiMode} factory.
 */
class AnsiModeImpl implements Mode {
    /** The numeric code of the ANSI mode. */
    public readonly code: number;
    /** For ANSI modes, this is always `false`. */
    public readonly isDecMode = false;

    /**
     * Creates an instance of an ANSI mode.
     * @param code - The numeric code for the ANSI mode.
     */
    constructor(code: number) {
        this.code = code;
    }
}

/**
 * Abstract base class for representing a private DEC terminal mode.
 * Ensures that `isDecMode` is `true`.
 * @internal We don't export this directly; use {@link createDecMode} factory.
 */
class DecModeImpl implements Mode {
    /** The numeric code of the DEC private mode. */
    public readonly code: number;
    /** For DEC private modes, this is always `true`. */
    public readonly isDecMode = true;

    /**
     * Creates an instance of a DEC private mode.
     * @param code - The numeric code for the DEC mode.
     */
    constructor(code: number) {
        this.code = code;
    }
}

/**
 * Represents a standard ANSI terminal mode (e.g., IRM, KAM). These modes are controlled by
 * sequences like `CSI Pn h` (Set) and `CSI Pn l` (Reset), without a `?` prefix.
 * This is a type alias for the base {@link Mode} interface, specialized for ANSI modes.
 *
 * @see {@link Mode}
 * @see {@link createAnsiMode} to create instances.
 */
export type AnsiMode = Mode;

/**
 * Represents a private DEC terminal mode (e.g., DECTCEM, DECAWM). These modes are controlled by
 * sequences like `CSI ? Pn h` (Set) and `CSI ? Pn l` (Reset), identified by the `?` prefix.
 * This is a type alias for the base {@link Mode} interface, specialized for DEC modes.
 *
 * @see {@link Mode}
 * @see {@link createDecMode} to create instances.
 */
export type DecMode = Mode;

/**
 * Factory function to create a standard ANSI mode object.
 *
 * @param code - The numeric code for the ANSI mode (e.g., `4` for Insert/Replace Mode).
 * @returns An `AnsiMode` object representing the specified ANSI mode.
 * @example
 * \`\`\`typescript
 * import { createAnsiMode, setMode, resetMode } from '@visulima/ansi/mode';
 *
 * const insertReplaceMode = createAnsiMode(4); // ANSI Mode 4: IRM
 * const srmMode = createAnsiMode(12); // ANSI Mode 12: SRM
 *
 * process.stdout.write(setMode(insertReplaceMode));   // CSI 4h
 * process.stdout.write(resetMode(srmMode));      // CSI 12l
 * \`\`\`
 */
export const createAnsiMode = (code: number): AnsiMode => {
    return new AnsiModeImpl(code);
};

/**
 * Factory function to create a private DEC mode object.
 *
 * @param code - The numeric code for the DEC mode (e.g., `25` for Text Cursor Enable Mode DECTCEM).
 * @returns A `DecMode` object representing the specified DEC private mode.
 * @example
 * \`\`\`typescript
 * import { createDecMode, setMode, resetMode } from '@visulima/ansi/mode';
 *
 * const cursorVisibleMode = createDecMode(25); // DEC Mode 25: DECTCEM (Text Cursor Enable)
 * const originMode = createDecMode(6);       // DEC Mode 6: DECOM (Origin Mode)
 *
 * process.stdout.write(setMode(cursorVisibleMode)); // CSI ?25h
 * process.stdout.write(resetMode(originMode));    // CSI ?6l
 * \`\`\`
 */
export const createDecMode = (code: number): DecMode => {
    return new DecModeImpl(code);
};

/**
 * Generates the ANSI/DEC sequence to set one or more terminal modes.
 *
 * - For standard ANSI modes, the format is `CSI Pn ; ... ; Pn h`.
 * - For private DEC modes, the format is `CSI ? Pn ; ... ; Pn h`.
 *
 * If a mix of ANSI and DEC modes are provided (e.g., `setMode(ansiMode1, decMode1, ansiMode2)`),
 * it produces two separate sequences concatenated (e.g., `CSI Pn(A1);Pn(A2)h CSI ?Pn(D1)h`).
 * The order of ANSI vs. DEC sequences in the output is not guaranteed but will group them correctly.
 *
 * @param modes - A list of {@link Mode} objects (either `AnsiMode` or `DecMode`) to set.
 * @returns The ANSI escape sequence(s) to set the specified modes. Returns an empty string if no modes are provided.
 * @see {@link https://vt100.net/docs/vt510-rm/SM.html Set Mode (SM) documentation}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-Ps-space-letter} (DECSET related section)
 * @example
 * \`\`\`typescript
 * import { createAnsiMode, createDecMode, setMode, TextCursorEnableMode, OriginMode, InsertReplaceMode, LineFeedNewLineMode } from '@visulima/ansi/mode';
 *
 * // Set a single DEC mode
 * console.log(setMode(TextCursorEnableMode)); // CSI ?25h (assuming TextCursorEnableMode is DEC mode 25)
 *
 * // Set multiple ANSI modes
 * console.log(setMode(InsertReplaceMode, LineFeedNewLineMode)); // CSI 4;20h (assuming IRM is 4, LNM is 20)
 *
 * // Set a mix of modes
 * console.log(setMode(OriginMode, InsertReplaceMode)); // e.g., CSI 4hCSI ?6h (order of groups may vary)
 * \`\`\`
 */
export const setMode = (...modes: Mode[]): string => {
    return generateModeSequence(false, ...modes);
};

/**
 * Alias for {@link setMode}. Generates the SM (Set Mode) sequence.
 *
 * @param modes - A list of {@link Mode} objects to set.
 * @returns The ANSI escape sequence(s) to set the specified modes.
 * @see {@link setMode} for more details and examples.
 */
export const SM = setMode;

/**
 * Generates the ANSI/DEC sequence to reset one or more terminal modes.
 *
 * - For standard ANSI modes, the format is `CSI Pn ; ... ; Pn l`.
 * - For private DEC modes, the format is `CSI ? Pn ; ... ; Pn l`.
 *
 * If a mix of ANSI and DEC modes are provided (e.g., `resetMode(ansiMode1, decMode1, ansiMode2)`),
 * it produces two separate sequences concatenated (e.g., `CSI Pn(A1);Pn(A2)l CSI ?Pn(D1)l`).
 * The order of ANSI vs. DEC sequences in the output is not guaranteed but will group them correctly.
 *
 * @param modes - A list of {@link Mode} objects (either `AnsiMode` or `DecMode`) to reset.
 * @returns The ANSI escape sequence(s) to reset the specified modes. Returns an empty string if no modes are provided.
 * @see {@link https://vt100.net/docs/vt510-rm/RM.html Reset Mode (RM) documentation}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-Ps-space-letter} (DECRST related section)
 * @example
 * \`\`\`typescript
 * import { createAnsiMode, createDecMode, resetMode, TextCursorEnableMode, OriginMode, InsertReplaceMode, LineFeedNewLineMode } from \'@visulima/ansi/mode\';
 *
 * // Reset a single DEC mode
 * console.log(resetMode(TextCursorEnableMode)); // CSI ?25l (assuming TextCursorEnableMode is DEC mode 25)
 *
 * // Reset multiple ANSI modes
 * console.log(resetMode(InsertReplaceMode, LineFeedNewLineMode)); // CSI 4;20l (assuming IRM is 4, LNM is 20)
 *
 * // Reset a mix of modes
 * console.log(resetMode(OriginMode, InsertReplaceMode)); // e.g., CSI 4lCSI ?6l (order of groups may vary)
 * \`\`\`
 */
export const resetMode = (...modes: Mode[]): string => {
    return generateModeSequence(true, ...modes);
};

/**
 * Alias for {@link resetMode}. Generates the RM (Reset Mode) sequence.
 *
 * @param modes - A list of {@link Mode} objects to reset.
 * @returns The ANSI escape sequence(s) to reset the specified modes.
 * @see {@link resetMode} for more details and examples.
 */
export const RM = resetMode;

/**
 * Internal helper function to generate mode sequences (SM or RM).
 *
 * It separates ANSI and DEC modes and constructs the appropriate CSI sequences.
 *
 * @param reset - If `true`, generates a reset sequence (ending in `l`); otherwise, a set sequence (ending in `h`).
 * @param modes - An array of {@link Mode} objects to include in the sequence.
 * @returns The complete ANSI escape sequence string.
 * @internal
 */
const generateModeSequence = (reset: boolean, ...modes: Mode[]): string => {
    if (modes.length === 0) {
        return "";
    }

    const command = reset ? "l" : "h";

    const ansiModes = modes.filter((mode) => !mode.isDecMode).map((mode) => mode.code);
    const decModes = modes.filter((mode) => mode.isDecMode).map((mode) => mode.code);

    let sequence = "";

    if (ansiModes.length > 0) {
        sequence += `${CSI}${ansiModes.join(";")}${command}`;
    }

    if (decModes.length > 0) {
        sequence += `${CSI}?${decModes.join(";")}${command}`;
    }

    return sequence;
};

/**
 * Generates the DECRQM (Request Mode) sequence to query the state of a specific terminal mode.
 *
 * The terminal is expected to respond with a DECRPM (Report Mode) sequence indicating the mode's current setting.
 *
 * - For a standard ANSI mode, the format is `CSI Pn $ p`.
 * - For a private DEC mode, the format is `CSI ? Pn $ p`.
 *
 * @param mode - The {@link Mode} object (either `AnsiMode` or `DecMode`) to query.
 * @returns The DECRQM escape sequence to request the mode state.
 * @see {@link https://vt100.net/docs/vt510-rm/DECRQM.html DECRQM documentation}
 * @see {@link reportMode} for the corresponding response sequence (DECRPM).
 * @see {@link ModeSetting} for possible reported states.
 * @example
 * \`\`\`typescript
 * import { requestMode, TextCursorEnableMode, InsertReplaceMode } from \'@visulima/ansi/mode\';
 *
 * // Request state of DEC Mode 25 (Text Cursor Enable)
 * process.stdout.write(requestMode(TextCursorEnableMode)); // Outputs: CSI ?25$p
 *
 * // Request state of ANSI Mode 4 (Insert/Replace Mode)
 * process.stdout.write(requestMode(InsertReplaceMode));    // Outputs: CSI 4$p
 * \`\`\`
 */
export const requestMode = (mode: Mode): string => {
    if (mode.isDecMode) {
        return `${CSI}?${mode.code}$p`;
    }

    return `${CSI}${mode.code}$p`;
};

/**
 * Alias for {@link requestMode}. Generates the DECRQM (Request Mode) sequence.
 *
 * @param mode - The {@link Mode} to query.
 * @returns The DECRQM escape sequence.
 * @see {@link requestMode} for more details.
 */
export const DECRQM = requestMode;

/**
 * Generates the DECRPM (Report Mode) sequence, which is the terminal's response to a DECRQM request.
 * This sequence indicates the current setting of a queried mode.
 *
 * - For a standard ANSI mode, the format is `CSI Pn ; Ps $ y`.
 * - For a private DEC mode, the format is `CSI ? Pn ; Ps $ y`.
 *
 * Where `Pn` is the mode number and `Ps` is a value from {@link ModeSetting}.
 *
 * This function is typically used for testing or simulating terminal behavior,
 * as applications usually receive this sequence from the terminal, not generate it.
 *
 * @param mode - The {@link Mode} object (either `AnsiMode` or `DecMode`) whose state is being reported.
 * @param value - The {@link ModeSetting} value indicating the current state of the mode.
 * @returns The DECRPM escape sequence reporting the mode state.
 * @see {@link https://vt100.net/docs/vt510-rm/DECRPM.html DECRPM documentation}
 * @see {@link requestMode} for the corresponding request sequence (DECRQM).
 * @example
 * \`\`\`typescript
 * import { reportMode, TextCursorEnableMode, InsertReplaceMode, ModeSetting } from \'@visulima/ansi/mode\';
 *
 * // Report that DEC Mode 25 (Text Cursor Enable) is Set
 * console.log(reportMode(TextCursorEnableMode, ModeSetting.Set)); // Outputs: CSI ?25;1$y
 *
 * // Report that ANSI Mode 4 (Insert/Replace Mode) is Reset
 * console.log(reportMode(InsertReplaceMode, ModeSetting.Reset)); // Outputs: CSI 4;2$y
 *
 * // Report that a hypothetical DEC mode 1049 is NotRecognized
 * import { createDecMode } from \'@visulima/ansi/mode\';
 * const customDecMode = createDecMode(1049);
 * console.log(reportMode(customDecMode, ModeSetting.NotRecognized)); // Outputs: CSI ?1049;0$y
 * \`\`\`
 */
export const reportMode = (mode: Mode, value: ModeSetting): string => {
    let effectiveValue = value;

    // Ensure value is within the defined ModeSetting enum range (0-4).
    // If not, default to NotRecognized as per common terminal behavior for invalid report parameters.
    if (value < ModeSetting.NotRecognized || value > ModeSetting.PermanentlyReset) {
        effectiveValue = ModeSetting.NotRecognized;
    }

    if (mode.isDecMode) {
        return `${CSI}?${mode.code};${effectiveValue}$y`;
    }

    return `${CSI}${mode.code};${effectiveValue}$y`;
};

/**
 * Alias for {@link reportMode}. Generates the DECRPM (Report Mode) sequence.
 *
 * @param mode - The {@link Mode} whose state is being reported.
 * @param value - The {@link ModeSetting} value.
 * @returns The DECRPM escape sequence.
 * @see {@link reportMode} for more details.
 */
export const DECRPM = reportMode;

// Standard ANSI Modes (SM/RM)
// See: https://vt100.net/docs/vt510-rm/SM.html
// And: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-Ps-space-letter

/**
 * ANSI Mode 2: Keyboard Action Mode (KAM).
 *
 * - `Set` (SM): Keyboard locked.
 * - `Reset` (RM): Keyboard unlocked.
 *
 * If set, the keyboard is locked, meaning no keys are sent to the host.
 * If reset, the keyboard is unlocked, and keys are sent normally.
 * This mode is rarely used in modern terminal emulators but is part of the standard.
 *
 * @see {@link createAnsiMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const KeyboardActionMode = createAnsiMode(2);

/**
 * ANSI Mode 4: Insert/Replace Mode (IRM).
 *
 * - `Set` (SM): Insert Mode. Newly received characters are inserted at the cursor position,
 *   shifting existing characters to the right.
 * - `Reset` (RM): Replace Mode (default). Newly received characters overwrite existing characters
 *   at the cursor position.
 *
 * @see {@link createAnsiMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const InsertReplaceMode = createAnsiMode(4);

/**
 * ANSI Mode 12: Send/Receive Mode (SRM).
 *
 * - `Set` (SM): Local Echo Off. Characters typed on the keyboard are not echoed locally by the terminal;
 *   they are only sent to the host. The host is expected to echo them back if they should be displayed.
 * - `Reset` (RM): Local Echo On (default for some systems). Characters typed are echoed locally by the terminal
 *   as well as sent to the host.
 *
 * This mode controls local echoing of typed characters. It's primarily relevant for half-duplex communication
 * or when the host explicitly manages echoing.
 *
 * @see {@link createAnsiMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const SendReceiveMode = createAnsiMode(12);

/**
 * ANSI Mode 20: Line Feed/New Line Mode (LNM).
 *
 * - `Set` (SM): New Line Mode. A line feed (LF), form feed (FF), or vertical tab (VT) control character
 *   received from the host causes the cursor to move to the first column of the next line (CR+LF effect).
 * - `Reset` (RM): Line Feed Mode (default). A line feed (LF), form feed (FF), or vertical tab (VT)
 *   moves the cursor to the current column of the next line.
 *
 * This mode affects how the terminal interprets line-ending characters.
 *
 * @see {@link createAnsiMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const LineFeedNewLineMode = createAnsiMode(20);

// Private DEC Modes (DECSET/DECRST)
// See: https://vt100.net/docs/vt510-rm/DECSET.html
// And: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-question-mark-Ps-space-letter

/**
 * DEC Private Mode 1: Application Cursor Keys (DECCKM).
 *
 * - `Set` (DECSET): Cursor keys (Up, Down, Left, Right) send application-specific escape sequences
 *   (e.g., `ESC O A` for Up Arrow).
 * - `Reset` (DECRST): Cursor keys send ANSI cursor control sequences (e.g., `CSI A` for Up Arrow) (default).
 *
 * This mode allows applications to receive distinct sequences for cursor keys, often used by full-screen editors
 * like Vim or Emacs to differentiate normal cursor movement from application-controlled movement.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const ApplicationCursorKeysMode = createDecMode(1);

/**
 * DEC Private Mode 3: 132 Column Mode (DECCOLM).
 * Switches the screen width between 80 and 132 columns.
 * - `Set` (DECSET): Switches to 132 column mode.
 * - `Reset` (DECRST): Switches to 80 column mode.
 * Some terminals might clear the screen when this mode is changed.
 *
 * @see {@link https://vt100.net/docs/vt510-rm/DECCOLM.html DECCOLM documentation}
 * @see {@link createDecMode}
 */
export const DECCOLM_132ColumnMode = createDecMode(3);

/**
 * DEC Private Mode 2: Designate USASCII for character sets G0-G3 (DECANM), and select VT52 mode.
 *
 * - `Set` (DECSET): VT52 Mode. The terminal emulates a VT52 terminal. Character sets are implicitly USASCII.
 * - `Reset` (DECRST): ANSI Mode (default). The terminal operates in its primary ANSI-compatible mode (e.g., VT100, VT220, xterm).
 *
 * When set, the terminal switches to VT52 compatibility mode. This is a very old mode and typically
 * only relevant for legacy applications or specific terminal types. Most modern applications expect ANSI mode.
 * DECANM also implies that G0, G1, G2, and G3 are all USASCII. When reset (default), the terminal operates in its native (usually ANSI) mode.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://vt100.net/docs/vt510-rm/DECANM.html DECANM documentation}
 */
export const AnsiVt52Mode = createDecMode(2);

/**
 * DEC Private Mode 5: Screen Mode (DECSCNM) - Normal/Reverse Video.
 *
 * - `Set` (DECSET): Normal Video. The screen displays with normal foreground and background colors.
 * - `Reset` (DECRST): Inverse Video. The screen display is inverted (foreground and background colors are swapped).
 *
 * This mode inverts the entire screen's colors. It's a visual effect and doesn't change the underlying character attributes.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://vt100.net/docs/vt510-rm/DECSCNM.html DECSCNM documentation}
 */
export const AttributedScreenMode = createDecMode(5);

/**
 * DEC Private Mode 6: Origin Mode (DECOM).
 * Controls whether cursor addressing is relative to the home position or the top-left
 * corner of the scrolling region (defined by DECSTBM - Set Top and Bottom Margins).
 * - `Set` (DECSET): Cursor addressing is relative to the top-left of the scrolling region.
 * - `Reset` (DECRST): Cursor addressing is relative to the physical screen's top-left (home).
 * This mode interacts with the `DECSLRM` (Set Left/Right Margins) mode as well.
 *
 * @see {@link https://vt100.net/docs/vt510-rm/DECOM.html DECOM documentation}
 * @see {@link createDecMode}
 * @see {@link setLeftRightMargins}
 * @see {@link setTopBottomMargins}
 */
export const OriginMode = createDecMode(6);

/**
 * DEC Private Mode 7: Wraparound Mode (DECAWM) - Auto Wraparound.
 *
 * - `Set` (DECSET): Auto-Wrap On (default). When the cursor reaches the rightmost column of the current line,
 *   it automatically moves to the first column of the next line. If it's at the bottom of a scrolling region,
 *   the region may scroll up.
 * - `Reset` (DECRST): Auto-Wrap Off. When the cursor is at the rightmost column, subsequent characters
 *   overwrite the character in that position. The cursor does not automatically advance to the next line.
 *
 * This mode controls whether the cursor automatically wraps to the next line when the end of the current line is reached.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://vt100.net/docs/vt510-rm/DECAWM.html DECAWM documentation}
 */
export const WraparoundMode = createDecMode(7);

/**
 * DEC Private Mode 8: Auto-Repeat Keys Mode (DECARM).
 *
 * - `Set` (DECSET): Auto-Repeat On (default). Keys held down will automatically repeat.
 * - `Reset` (DECRST): Auto-Repeat Off. Keys must be pressed multiple times to generate multiple characters.
 *
 * This mode controls whether holding down a key causes it to repeat. Most systems have this on by default.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const AutoRepeatKeysMode = createDecMode(8);

/**
 * DEC Private Mode 12: Blinking Cursor Enable Mode (ATT610, xterm variant).
 *
 * - `Set` (DECSET): Blinking Cursor On. The text cursor blinks.
 * - `Reset` (DECRST): Blinking Cursor Off (Steady Cursor). The text cursor does not blink.
 *
 * This is an xterm extension, also supported by some other terminals. It controls the blinking of the text cursor.
 * Note: Some sources list DECSET 12 as relating to text cursor style (block, underline) or blinking, behavior can vary.
 * This definition assumes the common xterm behavior of controlling blinking.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link TextCursorEnableMode} (DECTCEM) which controls visibility, not blinking.
 */
export const BlinkingCursorMode = createDecMode(12); // Note: xterm specific for blinking, DECSUSR might be another one.

/**
 * DEC Private Mode 25: Text Cursor Enable Mode (DECTCEM).
 *
 * - `Set` (DECSET): Cursor Visible (default). The text cursor is displayed.
 * - `Reset` (DECRST): Cursor Invisible. The text cursor is not displayed.
 *
 * This is the standard mode for controlling the visibility of the text cursor.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://vt100.net/docs/vt510-rm/DECTCEM.html DECTCEM documentation}
 */
export const TextCursorEnableMode = createDecMode(25);

/**
 * DEC Private Mode 30: Show Toolbar Mode (DECTBAR) - (xterm extension).
 *
 * - `Set` (DECSET): Show Toolbar. If the terminal supports a toolbar (e.g., xterm menu bar), this makes it visible.
 * - `Reset` (DECRST): Hide Toolbar. Hides the terminal's toolbar.
 *
 * This is an xterm-specific feature. Behavior on other terminals may vary or be unsupported.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const ShowToolbarMode = createDecMode(30);

/**
 * DEC Private Mode 35: Show Scrollbar Mode (DECSCLM) - (xterm extension).
 *
 * - `Set` (DECSET): Show Scrollbar. If the terminal supports a scrollbar (e.g., xterm), this makes it visible.
 * - `Reset` (DECRST): Hide Scrollbar. Hides the terminal's scrollbar.
 *
 * This is an xterm-specific feature. Behavior on other terminals may vary or be unsupported.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 */
export const ShowScrollbarMode = createDecMode(35);

/**
 * DEC Private Mode 47: Use Alternate Screen Buffer.
 *
 * - `Set` (DECSET): Switches to the alternate screen buffer.
 * - `Reset` (DECRST): Switches to the normal screen buffer (default).
 *
 * This command, when set, switches the terminal to an alternate screen buffer, clearing it first.
 * When reset, it switches back to the normal screen buffer and restores the cursor position
 * that was active on the normal buffer.
 * Commonly used by full-screen applications (like editors) to provide a separate screen
 * that doesn't disrupt the command history in the normal buffer.
 *
 * Note: This is often used interchangeably with or as part of the behavior of mode 1049.
 * Mode 1049 typically combines this with cursor saving/restoring and clearing.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link EnterAlternateScreenBuffer} (Mode 1047)
 * @see {@link SaveCursorAndEnterAlternateScreenBuffer} (Mode 1049)
 */
export const UseAlternateScreenBuffer = createDecMode(47);

/**
 * DEC Private Mode 1000: VT200 Mouse Reporting (Send VT200 Mouse X & Y on button press).
 *
 * - `Set` (DECSET): Enable basic mouse reporting. The terminal sends an escape sequence when a mouse button
 *   is pressed or released. This is the original X10 mouse protocol.
 * - `Reset` (DECRST): Disable mouse reporting (default).
 *
 * This mode enables reporting of mouse button clicks. The format of the reported sequence varies
 * but typically includes button information and X/Y coordinates.
 * More advanced mouse modes (1001, 1002, 1003, 1005, 1006, 1015) provide more detailed information
 * (e.g., motion, different encodings).
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking} Xterm Mouse Tracking documentation
 */
export const AllowXtermMouseReporting = createDecMode(1000);

/**
 * DEC Private Mode 1047: Use Alternate Screen Buffer (similar to 47), and clear it.
 *
 * - `Set` (DECSET): Switches to the alternate screen buffer and clears it.
 * - `Reset` (DECRST): Switches to the normal screen buffer.
 *
 * This mode is very similar to mode 47. Upon setting, it switches to the alternate screen
 * and the screen is cleared. Upon resetting, it switches back to the normal screen buffer.
 * Unlike mode 1049, it does not explicitly save/restore the cursor position on its own,
 * though terminals often pair this with DECSC/DECRC for cursor saving when using this mode.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link UseAlternateScreenBuffer} (Mode 47)
 * @see {@link SaveCursorAndEnterAlternateScreenBuffer} (Mode 1049)
 */
export const EnterAlternateScreenBuffer = createDecMode(1047);

/**
 * DEC Private Mode 1049: Save cursor as in DECSC, use Alternate Screen Buffer, clearing it first (xterm).
 *
 * - `Set` (DECSET): Saves the main screen buffer's cursor position, switches to the alternate screen buffer,
 *   and clears the alternate screen. This is often called "Enable Alternate Screen Buffer".
 * - `Reset` (DECRST): Restores the main screen buffer's cursor position and switches back to the main screen buffer.
 *   The content of the alternate screen is typically lost. This is often called "Disable Alternate Screen Buffer".
 *
 * This is a widely used mode by full-screen applications (e.g., `vim`, `less`, `htop`).
 * It combines the functionality of {@link UseAlternateScreenBuffer} (or {@link EnterAlternateScreenBuffer})
 * with cursor saving and restoring (like `DECSC`/`DECRC`) and clearing the alternate screen upon entry.
 *
 * This effectively provides a clean, separate screen for an application, and upon exit, restores
 * the user's previous screen state and cursor position, leaving no trace of the application's screen content.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link UseAlternateScreenBuffer} (Mode 47)
 * @see {@link EnterAlternateScreenBuffer} (Mode 1047)
 */
export const SaveCursorAndEnterAlternateScreenBuffer = createDecMode(1049);

/**
 * DEC Private Mode 1004: Focus Event Reporting (FocusIn/FocusOut).
 *
 * - `Set` (DECSET): Enable FocusIn/FocusOut event reporting. The terminal sends `CSI I` when it gains focus
 *   and `CSI O` when it loses focus.
 * - `Reset` (DECRST): Disable FocusIn/FocusOut event reporting (default).
 *
 * This mode is useful for applications that need to know when the terminal window gains or loses focus.
 * For example, an editor might stop a blinking cursor when the window is not focused.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-FocusIn_FocusOut} Xterm FocusIn/FocusOut documentation
 */
export const FocusTrackingMode = createDecMode(1004);

/**
 * DEC Private Mode 1005: UTF-8 Mouse Reporting (xterm extension).
 *
 * This mode is mentioned in xterm documentation but often superseded or used in conjunction with 1006 (SGR Mouse Mode).
 * It specifies that mouse coordinates should be UTF-8 encoded if they exceed 95 (0x5F, ASCII '_').
 * Modern terminals usually prefer SGR (1006) or SGR-Pixels (1016) mouse modes for richer data and simpler parsing.
 *
 * It is generally recommended to use {@link SgrMouseMode} (1006) for new applications.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link SgrMouseMode}
 * @deprecated Consider using SGR Mouse Mode (1006) for better compatibility and richer features.
 */
export const Utf8MouseReportingMode = createDecMode(1005);

/**
 * DEC Private Mode 1006: SGR Mouse Mode (xterm extension).
 *
 * - `Set` (DECSET): Enable SGR (Select Graphic Rendition) extended mouse reporting.
 *   Mouse events are reported in the format `CSI < Pb ; Px ; Py M` for button press
 *   and `CSI < Pb ; Px ; Py m` for button release.
 *   `Pb` contains button and modifier information, `Px` and `Py` are X/Y coordinates.
 *   This format is more robust than older mouse protocols as it doesn't clash with UTF-8 character streams.
 * - `Reset` (DECRST): Disable SGR mouse reporting.
 *
 * This is a widely supported and recommended mouse reporting mode for modern terminal applications
 * as it provides more detailed information (including button number, modifiers like Shift/Ctrl/Alt,
 * and mouse wheel events) and uses a syntax that is less ambiguous than older protocols, especially
 * with UTF-8 characters.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Extended-coordinates} Xterm SGR Mouse Mode documentation
 */
export const SgrMouseMode = createDecMode(1006);

/**
 * DEC Private Mode 1002: Cell Motion Mouse Tracking (VT200 / xterm).
 *
 * - `Set` (DECSET): Enable mouse reporting for button-down events and mouse motion while a button is pressed.
 * - `Reset` (DECRST): Disable this mouse reporting mode.
 *
 * This mode extends basic mouse reporting (like mode 1000) to also report mouse movement
 * (dragging) as long as a mouse button is held down.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link AllowXtermMouseReporting} (Mode 1000)
 * @see {@link AnyEventMouseTrackingMode} (Mode 1003) for tracking all mouse movements.
 */
export const CellMotionMouseTrackingMode = createDecMode(1002);

/**
 * DEC Private Mode 1003: All Motion Mouse Tracking (VT200 / xterm).
 *
 * - `Set` (DECSET): Enable reporting for all mouse movements, regardless of whether a button is pressed or not.
 * - `Reset` (DECRST): Disable this mouse reporting mode.
 *
 * This mode provides the most comprehensive mouse motion tracking, reporting events even when the mouse
 * is moved without any buttons being pressed (hover events).
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link CellMotionMouseTrackingMode} (Mode 1002) for tracking only when a button is pressed.
 */
export const AnyEventMouseTrackingMode = createDecMode(1003);

/**
 * DEC Private Mode 2004: Bracketed Paste Mode (xterm extension).
 *
 * - `Set` (DECSET): Enable Bracketed Paste Mode. When text is pasted into the terminal,
 *   it is enclosed in `ESC [ 200 ~` (paste start) and `ESC [ 201 ~` (paste end) sequences.
 * - `Reset` (DECRST): Disable Bracketed Paste Mode (default). Pasted text is sent as if typed by the user.
 *
 * This mode allows applications to distinguish pasted text from typed text. This is useful for preventing
 * accidental execution of commands if malicious text containing newlines is pasted into a shell, or for editors
 * to handle indentation and other formatting of pasted text more intelligently.
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Bracketed-Paste-Mode} Xterm Bracketed Paste Mode documentation
 * @example
 * \`\`\`typescript
 * import { setMode, resetMode, BracketedPasteMode } from \'@visulima/ansi/mode\';
 *
 * // Enable bracketed paste mode
 * process.stdout.write(setMode(BracketedPasteMode)); // CSI ?2004h
 *
 * // ... application receives CSI 200~ <pasted text> CSI 201~
 *
 * // Disable bracketed paste mode
 * process.stdout.write(resetMode(BracketedPasteMode)); // CSI ?2004l
 * \`\`\`
 */
export const BracketedPasteMode = createDecMode(2004);

/**
 * DEC Private Mode 9: X10 Mouse Reporting.
 * This is the original X10 mouse protocol. It reports button presses only.
 * The coordinates are sent as single characters, limiting the range (typically to 95x95 cells).
 * Format: `CSI M Cb Cx Cy` (Cb = button, Cx = X, Cy = Y).
 * - `Set` (DECSET): Enables X10 mouse reporting.
 * - `Reset` (DECRST): Disables X10 mouse reporting.
 *
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking} XTerm Mouse Tracking
 * @see {@link createDecMode}
 */
export const X10Mouse = createDecMode(9);

/**
 * DEC Private Mode 1001: VT200 Mouse Reporting (Send VT200 Mouse X & Y on button press).
 *
 * - `Set` (DECSET): Enable basic mouse reporting. The terminal sends an escape sequence when a mouse button
 *   is pressed or released. This is the original X10 mouse protocol.
 * - `Reset` (DECRST): Disable mouse reporting (default).
 *
 * This mode enables reporting of mouse button clicks. The format of the reported sequence varies
 * but typically includes button information and X/Y coordinates.
 * More advanced mouse modes (1002, 1003, 1005, 1006, 1015) provide more detailed information
 * (e.g., motion, different encodings).
 *
 * @see {@link createDecMode}
 * @see {@link setMode}
 * @see {@link resetMode}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking} Xterm Mouse Tracking documentation
 */
export const Vt200MouseReporting = createDecMode(1001);

/**
 * Manages the state of various terminal modes (both ANSI and DEC private modes).
 *
 * This class provides a way to keep track of which modes are currently considered
 * set, reset, permanently set, or permanently reset. It can be useful for applications
 * that need to maintain an internal model of the terminal's state, especially when
 * parsing responses to DECRQM (Request Mode) or when needing to make decisions
 * based on assumed mode states.
 *
 * The class itself does not interact with the terminal; it's a state management utility.
 * To actually change terminal modes, use functions like {@link setMode} or {@link resetMode}.
 *
 * @example
 * \`\`\`typescript
 * import { TerminalModes, TextCursorEnableMode, InsertReplaceMode, ModeSetting, reportMode } from \'@visulima/ansi/mode\';
 *
 * const termState = new TerminalModes();
 *
 * // Simulate receiving a DECRPM report that DECTCEM is set
 * // (This would typically come from parsing terminal input)
 * termState.updateFromReport(TextCursorEnableMode, ModeSetting.Set);
 *
 * console.log(termState.isSet(TextCursorEnableMode)); // true
 * console.log(termState.get(TextCursorEnableMode));    // ModeSetting.Set
 *
 * // Manually set IRM as active in our state model
 * termState.set(InsertReplaceMode);
 * console.log(termState.isSet(InsertReplaceMode));    // true
 *
 * // Reset it
 * termState.reset(InsertReplaceMode);
 * console.log(termState.isReset(InsertReplaceMode));  // true
 * console.log(termState.isSet(InsertReplaceMode));    // false
 *
 * // Mark TextCursorEnableMode as permanently set (e.g., if we know the terminal configuration)
 * termState.permanentlySet(TextCursorEnableMode);
 * console.log(termState.isPermanentlySet(TextCursorEnableMode)); // true
 * console.log(termState.get(TextCursorEnableMode));           // ModeSetting.PermanentlySet
 *
 * // Clear the state for a mode
 * termState.delete(InsertReplaceMode);
 * console.log(termState.get(InsertReplaceMode)); // ModeSetting.NotRecognized (or initial state)
 * \`\`\`
 */
export class TerminalModes {
    private readonly modes = new Map<string, ModeSetting>();
    private readonly initialDefaultState: ModeSetting;

    /**
     * Creates an instance of TerminalModes.
     * @param initialDefaultState - The {@link ModeSetting} to assume for modes that haven't been explicitly set, reset, or reported.
     * Defaults to {@link ModeSetting.NotRecognized}, meaning modes are considered unknown until specified.
     * You might set this to {@link ModeSetting.Reset} if you generally assume modes are off unless enabled.
     */
    constructor(initialDefaultState: ModeSetting = ModeSetting.NotRecognized) {
        this.initialDefaultState = initialDefaultState;
    }

    private getKey(mode: Mode): string {
        return `${mode.isDecMode ? "dec" : "ansi"}-${mode.code}`;
    }

    /**
     * Retrieves the current known setting of a given mode.
     *
     * @param mode - The {@link Mode} to query.
     * @returns The {@link ModeSetting} for the mode. If the mode's state is not explicitly tracked,
     *          it returns the `initialDefaultState` provided at construction (defaulting to `ModeSetting.NotRecognized`).
     */
    get(mode: Mode): ModeSetting {
        return this.modes.get(this.getKey(mode)) ?? this.initialDefaultState;
    }

    /**
     * Updates the state of a mode based on a reported value, typically from a DECRPM sequence.
     *
     * @param mode - The {@link Mode} whose state is being reported.
     * @param reportedSetting - The {@link ModeSetting} value reported by the terminal.
     */
    updateFromReport(mode: Mode, reportedSetting: ModeSetting): void {
        // Ensure reportedSetting is a valid enum member before storing
        if (Object.values(ModeSetting).includes(reportedSetting)) {
            this.modes.set(this.getKey(mode), reportedSetting);
        } else {
            // Handle invalid report, perhaps log or default to NotRecognized
            this.modes.set(this.getKey(mode), ModeSetting.NotRecognized);
        }
    }

    /**
     * Removes a mode from the tracked states. After deletion, querying this mode
     * with `get()` will return the `initialDefaultState`.
     *
     * @param mode - The {@link Mode} to remove from tracking.
     */
    delete(mode: Mode): void {
        this.modes.delete(this.getKey(mode));
    }

    /**
     * Internal helper to set a mode's state.
     *
     * @param setting - The {@link ModeSetting} to apply.
     * @param modesToUpdate - The mode(s) to update.
     * @internal
     */
    private setModeInternal(setting: ModeSetting, ...modesToUpdate: Mode[]): void {
        for (const mode of modesToUpdate) {
            this.modes.set(this.getKey(mode), setting);
        }
    }

    /**
     * Sets one or more modes to the "Set" state.
     *
     * @param modesToSet - The mode(s) to set.
     */
    set(...modesToSet: Mode[]): void {
        this.setModeInternal(ModeSetting.Set, ...modesToSet);
    }

    /**
     * Sets one or more modes to the "Reset" state.
     *
     * @param modesToReset - The mode(s) to reset.
     */
    reset(...modesToReset: Mode[]): void {
        this.setModeInternal(ModeSetting.Reset, ...modesToReset);
    }

    /**
     * Sets one or more modes to the "Permanently Set" state.
     *
     * @param modesToPermanentlySet - The mode(s) to permanently set.
     */
    permanentlySet(...modesToPermanentlySet: Mode[]): void {
        this.setModeInternal(ModeSetting.PermanentlySet, ...modesToPermanentlySet);
    }

    /**
     * Sets one or more modes to the "Permanently Reset" state.
     *
     * @param modesToPermanentlyReset - The mode(s) to permanently reset.
     */
    permanentlyReset(...modesToPermanentlyReset: Mode[]): void {
        this.setModeInternal(ModeSetting.PermanentlyReset, ...modesToPermanentlyReset);
    }

    /**
     * Checks if a mode is currently set.
     *
     * @param mode - The {@link Mode} to check.
     * @returns `true` if the mode is set or permanently set, `false` otherwise.
     */
    isSet(mode: Mode): boolean {
        return isModeSet(this.get(mode));
    }

    /**
     * Checks if a mode is currently reset (either {@link ModeSetting.Reset} or {@link ModeSetting.PermanentlyReset}).
     *
     * @param mode - The {@link Mode} to check.
     * @returns `true` if the mode is considered reset, `false` otherwise.
     */
    isReset(mode: Mode): boolean {
        const setting = this.get(mode);
        return setting === ModeSetting.Reset || setting === ModeSetting.PermanentlyReset;
    }

    /**
     * Checks if a mode is permanently set.
     *
     * @param mode - The {@link Mode} to check.
     * @returns `true` if the mode is permanently set, `false` otherwise.
     */
    isPermanentlySet(mode: Mode): boolean {
        return this.get(mode) === ModeSetting.PermanentlySet;
    }

    /**
     * Checks if a mode is considered {@link ModeSetting.PermanentlyReset}.
     *
     * @param mode - The {@link Mode} to check.
     * @returns `true` if the mode is considered permanently reset, `false` otherwise.
     */
    isPermanentlyReset(mode: Mode): boolean {
        return isModePermanentlyReset(this.get(mode));
    }

    /**
     * Checks if a mode is considered {@link ModeSetting.NotRecognized} or if its state is unknown
     * (i.e., it matches the `initialDefaultState` if that was `NotRecognized`).
     *
     * @param mode - The {@link Mode} to check.
     * @returns `true` if the mode is not recognized or unknown, `false` otherwise.
     */
    isNotRecognized(mode: Mode): boolean {
        return this.get(mode) === ModeSetting.NotRecognized;
    }
}

// Miscellaneous Mode Control Sequences
// These are less common or more specialized mode controls.

/**
 * DECSLRM: Set Left and Right Margins.
 *
 * Sets the left and right margins for subsequent text display. This defines the horizontal
 * boundaries for printing and scrolling within the current line.
 * `CSI Pl ; Pr s`
 *  - `Pl`: Left margin column number.
 *  - `Pr`: Right margin column number.
 *
 * If `Pl` or `Pr` are omitted, they default to 1 and the current screen width, respectively.
 * This command is often used in conjunction with DECOM (Origin Mode) and DECSTBM (Set Top and Bottom Margins)
 * to define a specific rectangular region for text operations.
 *
 * @param left - The column number for the left margin (1-indexed). If `undefined`, the left margin is not changed by this part of the sequence.
 * @param right - The column number for the right margin (1-indexed). If `undefined`, the right margin is not changed by this part of the sequence.
 * @returns The ANSI escape sequence to set left and right margins.
 * @see {@link https://vt100.net/docs/vt510-rm/DECSLRM.html DECSLRM documentation}
 * @example
 * \`\`\`typescript
 * import { setLeftRightMargins } from \'@visulima/ansi/mode\';
 *
 * // Set left margin to 10, right margin to 70
 * process.stdout.write(setLeftRightMargins(10, 70)); // CSI 10;70s
 *
 * // Set only left margin to 5 (right margin unchanged or default)
 * process.stdout.write(setLeftRightMargins(5));    // CSI 5s
 *
 * // Set only right margin to 60 (left margin unchanged or default)
 * process.stdout.write(setLeftRightMargins(undefined, 60)); // CSI ;60s
 *
 * // Reset to default margins (typically full width)
 * process.stdout.write(setLeftRightMargins());        // CSI s
 * \`\`\`
 */
export const setLeftRightMargins = (left?: number, right?: number): string => {
    if (left === undefined && right === undefined) {
        return `${CSI}s`;
    }
    if (left !== undefined && right !== undefined) {
        return `${CSI}${left};${right}s`;
    }
    if (left !== undefined) {
        return `${CSI}${left}s`;
    }
    // right !== undefined
    return `${CSI};${right}s`;
};

/**
 * DECSTBM: Set Top and Bottom Margins.
 *
 * Defines the top and bottom lines of the scrolling region.
 * `CSI Pt ; Pb r`
 *  - `Pt`: Top margin line number.
 *  - `Pb`: Bottom margin line number.
 *
 * If `Pt` or `Pb` are omitted, they default to 1 and the current screen height, respectively.
 * This creates a scrollable window within the screen. Text added outside this region
 * might not scroll, or behavior might be terminal-dependent.
 * Cursor movement is typically confined to this region when Origin Mode (DECOM) is active.
 *
 * @param top - The line number for the top margin (1-indexed). If `undefined`, the top margin is not changed by this part of the sequence.
 * @param bottom - The line number for the bottom margin (1-indexed). If `undefined`, the bottom margin is not changed by this part of the sequence.
 * @returns The ANSI escape sequence to set top and bottom margins.
 * @see {@link https://vt100.net/docs/vt510-rm/DECSTBM.html DECSTBM documentation}
 * @example
 * \`\`\`typescript
 * import { setTopBottomMargins } from \'@visulima/ansi/mode\';
 *
 * // Set scrolling region from line 5 to line 20
 * process.stdout.write(setTopBottomMargins(5, 20)); // CSI 5;20r
 *
 * // Set only top margin to 3 (bottom margin unchanged or default)
 * process.stdout.write(setTopBottomMargins(3));    // CSI 3r
 *
 * // Set only bottom margin to 22 (top margin unchanged or default)
 * process.stdout.write(setTopBottomMargins(undefined, 22)); // CSI ;22r
 *
 * // Reset to default margins (typically full screen)
 * process.stdout.write(setTopBottomMargins());        // CSI r
 * \`\`\`
 */
export const setTopBottomMargins = (top?: number, bottom?: number): string => {
    if (top === undefined && bottom === undefined) {
        return `${CSI}r`;
    }
    if (top !== undefined && bottom !== undefined) {
        return `${CSI}${top};${bottom}r`;
    }
    if (top !== undefined) {
        return `${CSI}${top}r`;
    }
    // bottom !== undefined
    return `${CSI};${bottom}r`;
};

// The following locator reporting modes are less common and more specific to certain terminals or applications.
// Refer to terminal documentation (like xterm ctlseqs) for precise behavior.

/**
 * Enables DEC locator reporting. (DECELR)
 * `CSI Ps ; Pe ' w` (Ps=enable/disable, Pe=event type)
 *
 * This is a more complex mode for reporting events from input devices like mice, tablets, etc.
 * The specific parameters control what events are reported and how.
 *
 * This is a low-level function to construct the sequence. You might need to consult
 * specific terminal documentation for the meaning of `enableCode` and `eventCode`.
 *
 * @param enableCode - A numeric code to enable (e.g., 1 or 2) or disable (e.g., 0) locator reporting.
 * @param eventCode - A numeric code specifying the type of events to report (e.g., 0 for button press, 1 for button release).
 * @returns The ANSI escape sequence for DECELR.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Locator-Reporting} Xterm Locator Reporting
 */
export const DecLocatorReporting = (enableCode: number, eventCode: number): string => CSI + `${enableCode};${eventCode}'w`;

/**
 * Sets the events for DEC locator reporting. (DECSLE)
 * `CSI Pe ' {` (Pe=event type)
 *
 * This command specifies which events trigger a locator report when DECELR is enabled.
 * Examples: `1` for button release, `2` for button press, etc.
 *
 * @param eventCode - A numeric code specifying the type of event.
 * @returns The ANSI escape sequence for DECSLE.
 */
export const SetDecLocatorEvents = (eventCode: number): string => CSI + `${eventCode}'{`;

/**
 * Selects the active locator events for reporting. (DECSACE)
 * `CSI Ps * x`
 *
 * This is part of the locator/mouse reporting system, allowing selection of which events are active.
 * The parameter `Ps` determines the type of event selection.
 * E.g., `Ps = 2` might enable reporting for specified events.
 *
 * @param parameter - A numeric parameter controlling event selection.
 * @returns The ANSI escape sequence for DECSACE.
 */
export const SelectActiveLocatorEvents = (parameter: number): string => CSI + `${parameter}*x`;

/**
 * Requests locator status. (DECRQLP)
 * `CSI Ps ' z`
 *
 * Queries the status of the locator device. The terminal responds with a DECRELP sequence.
 * `Ps` often defaults to 0 or is not used, but can specify aspects of the report.
 *
 * @param parameter - An optional numeric parameter for the request (often 0 or omitted).
 * @returns The ANSI escape sequence for DECRQLP.
 */
export const RequestLocatorStatus = (parameter = 0): string => CSI + `${parameter}'z`;

// Example of a specific locator reporting mode setup, though parameters can vary widely.
// This one seems to correspond to a common setup for enabling some form of pixel-based mouse reporting
// or advanced locator events, often seen in graphics applications or specific terminal configurations.
// The exact meaning of `parameter: 49` would be specific to the terminal implementing it.
// This is provided as an example of how such sequences are structured rather than a universally defined mode.

/**
 * Example: Set a specific Locator Reporting Mode (often related to pixel-based mouse coordinates or advanced events).
 * Sequence: `CSI ? Pn ; 49 h`
 *
 * This appears to be a less common or vendor-specific DEC private set mode sequence
 * where `Pn` is a parameter and `49` is a fixed part of this specific mode setting.
 * The exact behavior (what `Pn` controls and what mode `49` refers to in this context)
 * would depend on the terminal emulator implementing it.
 *
 * It's included as an example of more obscure or specialized mode settings.
 * Always consult terminal documentation for the precise meaning of such sequences.
 *
 * @param parameter - The primary numeric parameter for this mode setting.
 * @returns The ANSI escape sequence.
 */
export const SetLocatorReportingMode = (parameter: number) => CSI + `?${parameter};49h`; // Parameter indicates specific locator mode
