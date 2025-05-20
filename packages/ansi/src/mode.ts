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
 * ```typescript
 * import { createAnsiMode, setMode, resetMode } from '@visulima/ansi';
 *
 * const insertReplaceMode = createAnsiMode(4); // ANSI Mode 4: IRM
 * const srmMode = createAnsiMode(12); // ANSI Mode 12: SRM
 *
 * process.stdout.write(setMode(insertReplaceMode));   // CSI 4h
 * process.stdout.write(resetMode(srmMode));      // CSI 12l
 * ```
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
 * ```typescript
 * import { createDecMode, setMode, resetMode } from '@visulima/ansi';
 *
 * const cursorVisibleMode = createDecMode(25); // DEC Mode 25: DECTCEM (Text Cursor Enable)
 * const originMode = createDecMode(6);       // DEC Mode 6: DECOM (Origin Mode)
 *
 * process.stdout.write(setMode(cursorVisibleMode)); // CSI ?25h
 * process.stdout.write(resetMode(originMode));    // CSI ?6l
 * ```
 */
export const createDecMode = (code: number): DecMode => {
    return new DecModeImpl(code);
};

/**
 * Generates the ANSI/DEC sequence to set one or more terminal modes.
 * (SM - Set Mode)
 *
 * - For standard ANSI modes, the format is `CSI Pn ; ... ; Pn h`.
 * - For private DEC modes, the format is `CSI ? Pn ; ... ; Pn h`.
 *
 * If a mix of ANSI and DEC modes are provided (e.g., `setMode(ansiMode1, decMode1, ansiMode2)`),
 * it produces two separate sequences concatenated (e.g., `CSI Pn(A1);Pn(A2)hCSI ?Pn(D1)h`).
 * The order of ANSI vs. DEC sequences in the output depends on the current implementation (ANSI first).
 *
 * @param modes - A list of {@link Mode} objects (either `AnsiMode` or `DecMode`) to set.
 * @returns The ANSI escape sequence(s) to set the specified modes. Returns an empty string if no modes are provided.
 * @see {@link https://vt100.net/docs/vt510-rm/SM.html Set Mode (SM) documentation}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-Ps-space-letter} (DECSET related section)
 * @example
 * ```typescript
 * import { createAnsiMode, createDecMode, setMode, TextCursorEnableMode, OriginMode, InsertReplaceMode, LineFeedNewLineMode } from '@visulima/ansi';
 *
 * // Set a single DEC mode
 * console.log(setMode(TextCursorEnableMode)); // CSI ?25h (assuming TextCursorEnableMode is DEC mode 25)
 *
 * // Set multiple ANSI modes
 * console.log(setMode(InsertReplaceMode, LineFeedNewLineMode)); // CSI 4;20h (assuming IRM is 4, LNM is 20)
 *
 * // Set a mix of modes
 * console.log(setMode(OriginMode, InsertReplaceMode)); // e.g., CSI 4hCSI ?6h (order of groups may vary)
 * ```
 */
export const setMode = (...modes: Mode[]): string => {
    return generateModeSequence(false, ...modes);
};

/** Alias for {@link setMode}. Generates the SM (Set Mode) sequence. */
export const SM = setMode;

/**
 * Generates the ANSI/DEC sequence to reset one or more terminal modes.
 * (RM - Reset Mode)
 *
 * - For standard ANSI modes, the format is `CSI Pn ; ... ; Pn l`.
 * - For private DEC modes, the format is `CSI ? Pn ; ... ; Pn l`.
 *
 * If a mix of ANSI and DEC modes are provided (e.g., `resetMode(ansiMode1, decMode1, ansiMode2)`),
 * it produces two separate sequences concatenated (e.g., `CSI Pn(A1);Pn(A2)lCSI ?Pn(D1)l`).
 * The order of ANSI vs. DEC sequences in the output depends on the current implementation (ANSI first).
 *
 * @param modes - A list of {@link Mode} objects (either `AnsiMode` or `DecMode`) to reset.
 * @returns The ANSI escape sequence(s) to reset the specified modes. Returns an empty string if no modes are provided.
 * @see {@link https://vt100.net/docs/vt510-rm/RM.html Reset Mode (RM) documentation}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-Ps-space-letter} (DECRST related section)
 * @example
 * ```typescript
 * import { createAnsiMode, createDecMode, resetMode, TextCursorEnableMode, OriginMode, InsertReplaceMode, LineFeedNewLineMode } from '@visulima/ansi';
 *
 * // Reset a single DEC mode
 * console.log(resetMode(TextCursorEnableMode)); // CSI ?25l (assuming TextCursorEnableMode is DEC mode 25)
 *
 * // Reset multiple ANSI modes
 * console.log(resetMode(InsertReplaceMode, LineFeedNewLineMode)); // CSI 4;20l (assuming IRM is 4, LNM is 20)
 *
 * // Reset a mix of modes
 * console.log(resetMode(OriginMode, InsertReplaceMode)); // e.g., CSI 4lCSI ?6l (order of groups may vary)
 * ```
 */
export const resetMode = (...modes: Mode[]): string => {
    return generateModeSequence(true, ...modes);
};

/** Alias for {@link resetMode}. Generates the RM (Reset Mode) sequence. */
export const RM = resetMode;

/**
 * Internal helper function to generate mode sequences (SM or RM).
 *
 * It separates ANSI and DEC modes and constructs the appropriate CSI sequences.
 * If a single mode is provided, it generates a simpler sequence.
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

    if (modes.length === 1) {
        const mode = modes[0] as Mode; // Linter expects this to be possibly undefined otherwise
        let seq = CSI;
        if (mode.isDecMode) {
            seq += "?";
        }
        return seq + mode.code + command;
    }

    const ansiModes = modes.filter((m) => !m.isDecMode).map((m) => m.code);
    const decModes = modes.filter((m) => m.isDecMode).map((m) => m.code);

    let s = "";
    if (ansiModes.length > 0) {
        s += `${CSI}${ansiModes.join(";")}${command}`;
    }
    if (decModes.length > 0) {
        s += `${CSI}?${decModes.join(";")}${command}`;
    }
    return s;
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
 * ```typescript
 * import { requestMode, TextCursorEnableMode, InsertReplaceMode } from '@visulima/ansi';
 *
 * // Request state of DEC Mode 25 (Text Cursor Enable)
 * process.stdout.write(requestMode(TextCursorEnableMode)); // Outputs: CSI ?25$p
 *
 * // Request state of ANSI Mode 4 (Insert/Replace Mode)
 * process.stdout.write(requestMode(InsertReplaceMode));    // Outputs: CSI 4$p
 * ```
 */
export const requestMode = (mode: Mode): string => {
    let seq = CSI;
    if (mode.isDecMode) {
        seq += "?";
    }
    return seq + mode.code + "$p";
};

/** Alias for {@link requestMode}. Generates the DECRQM (Request Mode) sequence. */
export const DECRQM = requestMode;

/**
 * Generates the DECRPM (Report Mode) sequence, which is the terminal's response to a DECRQM request.
 * This sequence indicates the current setting of a queried mode.
 *
 * - For a standard ANSI mode, the format is `CSI Pn ; Ps $ y`.
 * - For a private DEC mode, the format is `CSI ? Pn ; Ps $ y`.
 *
 * Where `Pn` is the mode number and `Ps` is a value from {@link ModeSetting} (0-4).
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
 * ```typescript
 * import { reportMode, TextCursorEnableMode, InsertReplaceMode, ModeSetting, createDecMode } from '@visulima/ansi';
 *
 * // Report that DEC Mode 25 (Text Cursor Enable) is Set
 * console.log(reportMode(TextCursorEnableMode, ModeSetting.Set)); // Outputs: CSI ?25;1$y
 *
 * // Report that ANSI Mode 4 (Insert/Replace Mode) is Reset
 * console.log(reportMode(InsertReplaceMode, ModeSetting.Reset)); // Outputs: CSI 4;2$y
 *
 * // Report that a hypothetical DEC mode 1049 is NotRecognized
 * const customDecMode = createDecMode(1049);
 * console.log(reportMode(customDecMode, ModeSetting.NotRecognized)); // Outputs: CSI ?1049;0$y
 * ```
 */
export const reportMode = (mode: Mode, value: ModeSetting): string => {
    let effectiveValue = value;
    // Ensure value is within the defined ModeSetting enum range (0-4).
    // If not, default to NotRecognized as per common terminal behavior for invalid report parameters.
    if (value < ModeSetting.NotRecognized || value > ModeSetting.PermanentlyReset) {
        effectiveValue = ModeSetting.NotRecognized;
    }

    let seq = CSI;
    if (mode.isDecMode) {
        seq += "?";
    }
    return `${seq}${mode.code};${effectiveValue}$y`;
};

/** Alias for {@link reportMode}. Generates the DECRPM (Report Mode) sequence. */
export const DECRPM = reportMode;

// ANSI Modes

/**
 * ANSI Mode 2: Keyboard Action Mode (KAM).
 * Controls locking of the keyboard. When locked, the keyboard cannot send data.
 * @see {@link https://vt100.net/docs/vt510-rm/KAM.html}
 */
export const KeyboardActionMode = createAnsiMode(2);
/** Alias for {@link KeyboardActionMode}. */
export const KAM = KeyboardActionMode;
/** Sequence to set Keyboard Action Mode: `CSI 2 h` */
export const SetKeyboardActionMode = `${CSI}2h`;
/** Sequence to reset Keyboard Action Mode: `CSI 2 l` */
export const ResetKeyboardActionMode = `${CSI}2l`;
/** Sequence to request Keyboard Action Mode state: `CSI 2 $ p` */
export const RequestKeyboardActionMode = `${CSI}2$p`;

/**
 * ANSI Mode 4: Insert/Replace Mode (IRM).
 * Determines if new characters insert or replace existing ones.
 * @see {@link https://vt100.net/docs/vt510-rm/IRM.html}
 */
export const InsertReplaceMode = createAnsiMode(4);
/** Alias for {@link InsertReplaceMode}. */
export const IRM = InsertReplaceMode;
/** Sequence to set Insert/Replace Mode: `CSI 4 h` */
export const SetInsertReplaceMode = `${CSI}4h`;
/** Sequence to reset Insert/Replace Mode: `CSI 4 l` */
export const ResetInsertReplaceMode = `${CSI}4l`;
/** Sequence to request Insert/Replace Mode state: `CSI 4 $ p` */
export const RequestInsertReplaceMode = `${CSI}4$p`;

/**
 * ANSI Mode 8: BiDirectional Support Mode (BDSM).
 * Determines if the terminal supports bidirectional text (implicit mode).
 * @see ECMA-48 7.2.1.
 */
export const BiDirectionalSupportMode = createAnsiMode(8);
/** Alias for {@link BiDirectionalSupportMode}. */
export const BDSM = BiDirectionalSupportMode;
/** Sequence to set BiDirectional Support Mode: `CSI 8 h` */
export const SetBiDirectionalSupportMode = `${CSI}8h`;
/** Sequence to reset BiDirectional Support Mode: `CSI 8 l` */
export const ResetBiDirectionalSupportMode = `${CSI}8l`;
/** Sequence to request BiDirectional Support Mode state: `CSI 8 $ p` */
export const RequestBiDirectionalSupportMode = `${CSI}8$p`;

/**
 * ANSI Mode 12: Send/Receive Mode (SRM) or Local Echo Mode.
 * Determines if the terminal echoes typed characters locally.
 * @see {@link https://vt100.net/docs/vt510-rm/SRM.html}
 */
export const SendReceiveMode = createAnsiMode(12);
/** Alias for {@link SendReceiveMode}. */
export const LocalEchoMode = SendReceiveMode;
/** Alias for {@link SendReceiveMode}. */
export const SRM = SendReceiveMode;
/** Sequence to set Send/Receive Mode: `CSI 12 h` */
export const SetSendReceiveMode = `${CSI}12h`;
/** Sequence to reset Send/Receive Mode: `CSI 12 l` */
export const ResetSendReceiveMode = `${CSI}12l`;
/** Sequence to request Send/Receive Mode state: `CSI 12 $ p` */
export const RequestSendReceiveMode = `${CSI}12$p`;
/** Alias for {@link SetSendReceiveMode}. */
export const SetLocalEchoMode = SetSendReceiveMode;
/** Alias for {@link ResetSendReceiveMode}. */
export const ResetLocalEchoMode = ResetSendReceiveMode;
/** Alias for {@link RequestSendReceiveMode}. */
export const RequestLocalEchoMode = RequestSendReceiveMode;

/**
 * ANSI Mode 20: Line Feed/New Line Mode (LNM).
 * Determines how the terminal interprets line feed (LF), form feed (FF), and vertical tab (VT) characters.
 * - Set (New Line): LF, FF, VT cause CR+LF effect.
 * - Reset (Line Feed): LF, FF, VT move to next line, same column.
 * @see {@link https://vt100.net/docs/vt510-rm/LNM.html}
 */
export const LineFeedNewLineMode = createAnsiMode(20);
/** Alias for {@link LineFeedNewLineMode}. */
export const LNM = LineFeedNewLineMode;
/** Sequence to set Line Feed/New Line Mode: `CSI 20 h` */
export const SetLineFeedNewLineMode = `${CSI}20h`;
/** Sequence to reset Line Feed/New Line Mode: `CSI 20 l` */
export const ResetLineFeedNewLineMode = `${CSI}20l`;
/** Sequence to request Line Feed/New Line Mode state: `CSI 20 $ p` */
export const RequestLineFeedNewLineMode = `${CSI}20$p`;

// DEC Modes

/**
 * DEC Private Mode 1: Cursor Keys Mode (DECCKM).
 * Determines if cursor keys send ANSI cursor sequences or application-specific sequences.
 * - Set: Application sequences (e.g., `ESC O A` for Up Arrow).
 * - Reset: ANSI sequences (e.g., `CSI A` for Up Arrow) (default).
 * @see {@link https://vt100.net/docs/vt510-rm/DECCKM.html}
 */
export const CursorKeysMode = createDecMode(1);
/** Alias for {@link CursorKeysMode}. */
export const DECCKM = CursorKeysMode;
/** Sequence to set Cursor Keys Mode: `CSI ? 1 h` */
export const SetCursorKeysMode = `${CSI}?1h`;
/** Sequence to reset Cursor Keys Mode: `CSI ? 1 l` */
export const ResetCursorKeysMode = `${CSI}?1l`;
/** Sequence to request Cursor Keys Mode state: `CSI ? 1 $ p` */
export const RequestCursorKeysMode = `${CSI}?1$p`;

/**
 * DEC Private Mode 6: Origin Mode (DECOM).
 * Controls cursor addressing relative to home position or scrolling region top-left.
 * - Set: Relative to scrolling region.
 * - Reset: Relative to home position (default).
 * @see {@link https://vt100.net/docs/vt510-rm/DECOM.html}
 */
export const OriginMode = createDecMode(6);
/** Alias for {@link OriginMode}. */
export const DECOM = OriginMode;
/** Sequence to set Origin Mode: `CSI ? 6 h` */
export const SetOriginMode = `${CSI}?6h`;
/** Sequence to reset Origin Mode: `CSI ? 6 l` */
export const ResetOriginMode = `${CSI}?6l`;
/** Sequence to request Origin Mode state: `CSI ? 6 $ p` */
export const RequestOriginMode = `${CSI}?6$p`;

/**
 * DEC Private Mode 7: Auto Wrap Mode (DECAWM).
 * Determines if cursor wraps to next line upon reaching the right margin.
 * - Set: Auto-wrap enabled (default).
 * - Reset: Auto-wrap disabled (characters overwrite at right margin).
 * @see {@link https://vt100.net/docs/vt510-rm/DECAWM.html}
 */
export const AutoWrapMode = createDecMode(7);
/** Alias for {@link AutoWrapMode}. */
export const DECAWM = AutoWrapMode;
/** Sequence to set Auto Wrap Mode: `CSI ? 7 h` */
export const SetAutoWrapMode = `${CSI}?7h`;
/** Sequence to reset Auto Wrap Mode: `CSI ? 7 l` */
export const ResetAutoWrapMode = `${CSI}?7l`;
/** Sequence to request Auto Wrap Mode state: `CSI ? 7 $ p` */
export const RequestAutoWrapMode = `${CSI}?7$p`;

/**
 * DEC Private Mode 9: X10 Mouse Reporting Mode.
 * Reports mouse button presses. Coordinates are single characters (limited range).
 * Format: `CSI M Cb Cx Cy` (Cb=button-1, Cx=X, Cy=Y).
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const X10MouseMode = createDecMode(9);
/** Sequence to set X10 Mouse Mode: `CSI ? 9 h` */
export const SetX10MouseMode = `${CSI}?9h`;
/** Sequence to reset X10 Mouse Mode: `CSI ? 9 l` */
export const ResetX10MouseMode = `${CSI}?9l`;
/** Sequence to request X10 Mouse Mode state: `CSI ? 9 $ p` */
export const RequestX10MouseMode = `${CSI}?9$p`;

/**
 * DEC Private Mode 25: Text Cursor Enable Mode (DECTCEM).
 * Controls visibility of the text cursor.
 * - Set: Cursor visible (default).
 * - Reset: Cursor invisible.
 * @see {@link https://vt100.net/docs/vt510-rm/DECTCEM.html}
 */
export const TextCursorEnableMode = createDecMode(25);
/** Alias for {@link TextCursorEnableMode}. */
export const DECTCEM = TextCursorEnableMode;
/** Sequence to set Text Cursor Enable Mode (show cursor): `CSI ? 25 h` */
export const SetTextCursorEnableMode = `${CSI}?25h`;
/** Sequence to reset Text Cursor Enable Mode (hide cursor): `CSI ? 25 l` */
export const ResetTextCursorEnableMode = `${CSI}?25l`;
/** Sequence to request Text Cursor Enable Mode state: `CSI ? 25 $ p` */
export const RequestTextCursorEnableMode = `${CSI}?25$p`;
/** Alias for {@link SetTextCursorEnableMode} (shows cursor). */
export const ShowCursor = SetTextCursorEnableMode;
/** Alias for {@link ResetTextCursorEnableMode} (hides cursor). */
export const HideCursor = ResetTextCursorEnableMode;


/**
 * DEC Private Mode 66: Numeric Keypad Mode (DECNKM).
 * Determines if keypad sends application or numeric sequences.
 * @see {@link https://vt100.net/docs/vt510-rm/DECNKM.html}
 */
export const NumericKeypadMode = createDecMode(66);
/** Alias for {@link NumericKeypadMode}. */
export const DECNKM = NumericKeypadMode;
/** Sequence to set Numeric Keypad Mode: `CSI ? 66 h` */
export const SetNumericKeypadMode = `${CSI}?66h`;
/** Sequence to reset Numeric Keypad Mode: `CSI ? 66 l` */
export const ResetNumericKeypadMode = `${CSI}?66l`;
/** Sequence to request Numeric Keypad Mode state: `CSI ? 66 $ p` */
export const RequestNumericKeypadMode = `${CSI}?66$p`;

/**
 * DEC Private Mode 67: Backarrow Key Mode (DECBKM).
 * Determines if backspace key sends backspace (ASCII 8) or delete (ASCII 127).
 * - Set: Sends delete character.
 * - Reset: Sends backspace character (default).
 * @see {@link https://vt100.net/docs/vt510-rm/DECBKM.html}
 */
export const BackarrowKeyMode = createDecMode(67);
/** Alias for {@link BackarrowKeyMode}. */
export const DECBKM = BackarrowKeyMode;
/** Sequence to set Backarrow Key Mode: `CSI ? 67 h` */
export const SetBackarrowKeyMode = `${CSI}?67h`;
/** Sequence to reset Backarrow Key Mode: `CSI ? 67 l` */
export const ResetBackarrowKeyMode = `${CSI}?67l`;
/** Sequence to request Backarrow Key Mode state: `CSI ? 67 $ p` */
export const RequestBackarrowKeyMode = `${CSI}?67$p`;

/**
 * DEC Private Mode 69: Left/Right Margin Mode (DECLRMM).
 * Controls whether left and right margins can be set with DECSLRM.
 * @see {@link https://vt100.net/docs/vt510-rm/DECLRMM.html}
 */
export const LeftRightMarginMode = createDecMode(69);
/** Alias for {@link LeftRightMarginMode}. */
export const DECLRMM = LeftRightMarginMode;
/** Sequence to set Left/Right Margin Mode: `CSI ? 69 h` */
export const SetLeftRightMarginMode = `${CSI}?69h`;
/** Sequence to reset Left/Right Margin Mode: `CSI ? 69 l` */
export const ResetLeftRightMarginMode = `${CSI}?69l`;
/** Sequence to request Left/Right Margin Mode state: `CSI ? 69 $ p` */
export const RequestLeftRightMarginMode = `${CSI}?69$p`;

/**
 * DEC Private Mode 1000: Normal Mouse Mode.
 * Reports mouse button presses and releases, including modifiers, wheel events, and extra buttons.
 * Uses X10-like encoding with extensions.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const NormalMouseMode = createDecMode(1000);
/** Sequence to set Normal Mouse Mode: `CSI ? 1000 h` */
export const SetNormalMouseMode = `${CSI}?1000h`;
/** Sequence to reset Normal Mouse Mode: `CSI ? 1000 l` */
export const ResetNormalMouseMode = `${CSI}?1000l`;
/** Sequence to request Normal Mouse Mode state: `CSI ? 1000 $ p` */
export const RequestNormalMouseMode = `${CSI}?1000$p`;

/**
 * DEC Private Mode 1001: Highlight Mouse Tracking.
 * Reports button presses, releases, and highlighted cells.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const HighlightMouseMode = createDecMode(1001);
/** Sequence to set Highlight Mouse Tracking: `CSI ? 1001 h` */
export const SetHighlightMouseMode = `${CSI}?1001h`;
/** Sequence to reset Highlight Mouse Tracking: `CSI ? 1001 l` */
export const ResetHighlightMouseMode = `${CSI}?1001l`;
/** Sequence to request Highlight Mouse Tracking state: `CSI ? 1001 $ p` */
export const RequestHighlightMouseMode = `${CSI}?1001$p`;

/**
 * DEC Private Mode 1002: Button Event Mouse Tracking (Cell Motion Mouse Tracking).
 * Reports button-down events and mouse motion while a button is pressed.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const ButtonEventMouseMode = createDecMode(1002);
/** Sequence to set Button Event Mouse Tracking: `CSI ? 1002 h` */
export const SetButtonEventMouseMode = `${CSI}?1002h`;
/** Sequence to reset Button Event Mouse Tracking: `CSI ? 1002 l` */
export const ResetButtonEventMouseMode = `${CSI}?1002l`;
/** Sequence to request Button Event Mouse Tracking state: `CSI ? 1002 $ p` */
export const RequestButtonEventMouseMode = `${CSI}?1002$p`;

/**
 * DEC Private Mode 1003: Any Event Mouse Tracking (All Motion Mouse Tracking).
 * Reports all mouse movements, regardless of button state (includes hover).
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const AnyEventMouseMode = createDecMode(1003);
/** Sequence to set Any Event Mouse Tracking: `CSI ? 1003 h` */
export const SetAnyEventMouseMode = `${CSI}?1003h`;
/** Sequence to reset Any Event Mouse Tracking: `CSI ? 1003 l` */
export const ResetAnyEventMouseMode = `${CSI}?1003l`;
/** Sequence to request Any Event Mouse Tracking state: `CSI ? 1003 $ p` */
export const RequestAnyEventMouseMode = `${CSI}?1003$p`;

/**
 * DEC Private Mode 1004: Focus Event Mode.
 * Reports terminal focus (FocusIn `CSI I`) and blur (FocusOut `CSI O`) events.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Focus-Tracking}
 */
export const FocusEventMode = createDecMode(1004);
/** Sequence to set Focus Event Mode: `CSI ? 1004 h` */
export const SetFocusEventMode = `${CSI}?1004h`;
/** Sequence to reset Focus Event Mode: `CSI ? 1004 l` */
export const ResetFocusEventMode = `${CSI}?1004l`;
/** Sequence to request Focus Event Mode state: `CSI ? 1004 $ p` */
export const RequestFocusEventMode = `${CSI}?1004$p`;

/**
 * DEC Private Mode 1005: UTF-8 Extended Mouse Mode.
 * Mouse coordinates are UTF-8 encoded if they exceed 95.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const Utf8ExtMouseMode = createDecMode(1005);
/** Sequence to set UTF-8 Extended Mouse Mode: `CSI ? 1005 h` */
export const SetUtf8ExtMouseMode = `${CSI}?1005h`;
/** Sequence to reset UTF-8 Extended Mouse Mode: `CSI ? 1005 l` */
export const ResetUtf8ExtMouseMode = `${CSI}?1005l`;
/** Sequence to request UTF-8 Extended Mouse Mode state: `CSI ? 1005 $ p` */
export const RequestUtf8ExtMouseMode = `${CSI}?1005$p`;

/**
 * DEC Private Mode 1006: SGR Extended Mouse Mode.
 * Mouse events reported with SGR parameters: `CSI < Cb ; Cx ; Py M` (press) / `m` (release).
 * Robust and recommended for modern applications.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const SgrExtMouseMode = createDecMode(1006);
/** Sequence to set SGR Extended Mouse Mode: `CSI ? 1006 h` */
export const SetSgrExtMouseMode = `${CSI}?1006h`;
/** Sequence to reset SGR Extended Mouse Mode: `CSI ? 1006 l` */
export const ResetSgrExtMouseMode = `${CSI}?1006l`;
/** Sequence to request SGR Extended Mouse Mode state: `CSI ? 1006 $ p` */
export const RequestSgrExtMouseMode = `${CSI}?1006$p`;

/**
 * DEC Private Mode 1015: URXVT Extended Mouse Mode.
 * Uses an alternate encoding for mouse tracking.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const UrxvtExtMouseMode = createDecMode(1015);
/** Sequence to set URXVT Extended Mouse Mode: `CSI ? 1015 h` */
export const SetUrxvtExtMouseMode = `${CSI}?1015h`;
/** Sequence to reset URXVT Extended Mouse Mode: `CSI ? 1015 l` */
export const ResetUrxvtExtMouseMode = `${CSI}?1015l`;
/** Sequence to request URXVT Extended Mouse Mode state: `CSI ? 1015 $ p` */
export const RequestUrxvtExtMouseMode = `${CSI}?1015$p`;

/**
 * DEC Private Mode 1016: SGR Pixel Extended Mouse Mode.
 * Similar to SGR Extended Mode, but reports pixel coordinates.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking}
 */
export const SgrPixelExtMouseMode = createDecMode(1016);
/** Sequence to set SGR Pixel Extended Mouse Mode: `CSI ? 1016 h` */
export const SetSgrPixelExtMouseMode = `${CSI}?1016h`;
/** Sequence to reset SGR Pixel Extended Mouse Mode: `CSI ? 1016 l` */
export const ResetSgrPixelExtMouseMode = `${CSI}?1016l`;
/** Sequence to request SGR Pixel Extended Mouse Mode state: `CSI ? 1016 $ p` */
export const RequestSgrPixelExtMouseMode = `${CSI}?1016$p`;

/**
 * DEC Private Mode 1047: Alternate Screen Mode.
 * Switches to alternate screen buffer and clears it.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-The-Alternate-Screen-Buffer}
 */
export const AltScreenMode = createDecMode(1047);
/** Sequence to set Alternate Screen Mode: `CSI ? 1047 h` */
export const SetAltScreenMode = `${CSI}?1047h`;
/** Sequence to reset Alternate Screen Mode: `CSI ? 1047 l` */
export const ResetAltScreenMode = `${CSI}?1047l`;
/** Sequence to request Alternate Screen Mode state: `CSI ? 1047 $ p` */
export const RequestAltScreenMode = `${CSI}?1047$p`;

/**
 * DEC Private Mode 1048: Save Cursor Mode.
 * Saves current cursor position (like DECSC).
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-The-Alternate-Screen-Buffer}
 */
export const SaveCursorMode = createDecMode(1048);
/** Sequence to set Save Cursor Mode: `CSI ? 1048 h` */
export const SetSaveCursorMode = `${CSI}?1048h`;
/** Sequence to reset Save Cursor Mode: `CSI ? 1048 l` */
export const ResetSaveCursorMode = `${CSI}?1048l`;
/** Sequence to request Save Cursor Mode state: `CSI ? 1048 $ p` */
export const RequestSaveCursorMode = `${CSI}?1048$p`;

/**
 * DEC Private Mode 1049: Alternate Screen Save Cursor Mode.
 * Saves cursor, switches to alternate screen buffer, and clears screen.
 * Widely used by full-screen applications.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-The-Alternate-Screen-Buffer}
 */
export const AltScreenSaveCursorMode = createDecMode(1049);
/** Sequence to set Alternate Screen Save Cursor Mode: `CSI ? 1049 h` */
export const SetAltScreenSaveCursorMode = `${CSI}?1049h`;
/** Sequence to reset Alternate Screen Save Cursor Mode: `CSI ? 1049 l` */
export const ResetAltScreenSaveCursorMode = `${CSI}?1049l`;
/** Sequence to request Alternate Screen Save Cursor Mode state: `CSI ? 1049 $ p` */
export const RequestAltScreenSaveCursorMode = `${CSI}?1049$p`;

/**
 * DEC Private Mode 2004: Bracketed Paste Mode.
 * Encloses pasted text with `ESC [ 200 ~` and `ESC [ 201 ~`.
 * Allows applications to distinguish pasted text from typed text.
 * @see {@link https://cirw.in/blog/bracketed-paste}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Bracketed-Paste-Mode}
 */
export const BracketedPasteMode = createDecMode(2004);
/** Sequence to set Bracketed Paste Mode: `CSI ? 2004 h` */
export const SetBracketedPasteMode = `${CSI}?2004h`;
/** Sequence to reset Bracketed Paste Mode: `CSI ? 2004 l` */
export const ResetBracketedPasteMode = `${CSI}?2004l`;
/** Sequence to request Bracketed Paste Mode state: `CSI ? 2004 $ p` */
export const RequestBracketedPasteMode = `${CSI}?2004$p`;

/**
 * DEC Private Mode 2026: Synchronized Output Mode.
 * Helps synchronize output with the terminal, preventing issues like screen tearing or garbled output
 * when rapid updates occur. The exact mechanism can vary (e.g., batching updates, waiting for vsync).
 * @see {@link https://gist.github.com/christianparpart/d8a62cc1ab659194337d73e399004036}
 */
export const SynchronizedOutputMode = createDecMode(2026);
/** Sequence to set Synchronized Output Mode: `CSI ? 2026 h` */
export const SetSynchronizedOutputMode = `${CSI}?2026h`;
/** Sequence to reset Synchronized Output Mode: `CSI ? 2026 l` */
export const ResetSynchronizedOutputMode = `${CSI}?2026l`;
/** Sequence to request Synchronized Output Mode state: `CSI ? 2026 $ p` */
export const RequestSynchronizedOutputMode = `${CSI}?2026$p`;

/**
 * DEC Private Mode 2027: Grapheme Clustering Mode.
 * Instructs the terminal to treat grapheme clusters as single units for rendering and cursor movement.
 * Important for correct display of complex scripts and emojis.
 * @see {@link https://github.com/contour-terminal/terminal-unicode-core}
 */
export const GraphemeClusteringMode = createDecMode(2027);
/** Sequence to set Grapheme Clustering Mode: `CSI ? 2027 h` */
export const SetGraphemeClusteringMode = `${CSI}?2027h`;
/** Sequence to reset Grapheme Clustering Mode: `CSI ? 2027 l` */
export const ResetGraphemeClusteringMode = `${CSI}?2027l`;
/** Sequence to request Grapheme Clustering Mode state: `CSI ? 2027 $ p` */
export const RequestGraphemeClusteringMode = `${CSI}?2027$p`;

/**
 * DEC Private Mode 9001: Win32 Input Mode.
 * Relevant for Windows conPTY, influencing how keyboard input is processed and translated.
 * @see {@link https://github.com/microsoft/terminal/blob/main/doc/specs/%234999%20-%20Improved%20keyboard%20handling%20in%20Conpty.md}
 */
export const Win32InputMode = createDecMode(9001);
/** Sequence to set Win32 Input Mode: `CSI ? 9001 h` */
export const SetWin32InputMode = `${CSI}?9001h`;
/** Sequence to reset Win32 Input Mode: `CSI ? 9001 l` */
export const ResetWin32InputMode = `${CSI}?9001l`;
/** Sequence to request Win32 Input Mode state: `CSI ? 9001 $ p` */
export const RequestWin32InputMode = `${CSI}?9001$p`;
