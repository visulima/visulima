// Mouse Event Handling - Sequence Generation
// Based on X11 mouse button codes and Xterm mouse tracking protocols.
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
import { ESC } from "./constants";

// Bit masks for encoding the button byte (Cb)

/**
 * Bit mask for the Shift key modifier in mouse events.
 * @internal
 */
const MOUSE_BIT_SHIFT: number = 0b0000_0100; // Shift key

/**
 * Bit mask for the Alt (Meta) key modifier in mouse events.
 * @internal
 */
const MOUSE_BIT_ALT: number = 0b0000_1000; // Alt (Meta) key

/**
 * Bit mask for the Ctrl key modifier in mouse events.
 * @internal
 */
const MOUSE_BIT_CTRL: number = 0b0001_0000; // Ctrl key

/**
 * Bit mask indicating a mouse motion event.
 * @internal
 */
const MOUSE_BIT_MOTION: number = 0b0010_0000; // Motion event

/**
 * Bit mask indicating a mouse wheel event, modifying the interpretation of button bits 0-3.
 * @internal
 */
const MOUSE_BIT_WHEEL: number = 0b0100_0000; // Indicates a wheel event (modifies button bits 0-3)

/**
 * Bit mask indicating additional buttons 8-11, modifying the interpretation of button bits 0-3.
 * @internal
 */
const MOUSE_BIT_ADDITIONAL: number = 0b1000_0000; // Indicates additional buttons 8-11 (modifies button bits 0-3)

/**
 * Bit mask for extracting the raw button part (0-3) from an encoded button byte.
 * @internal
 */
const MOUSE_BUTTON_BITS_MASK: number = 0b0000_0011; // For extracting the raw button part (0-3)

/**
 * Offset used for character encoding in X10 mouse protocol.
 * @internal
 */
const X10_MOUSE_OFFSET: number = 32;

/**
 * Defines codes for various mouse buttons and actions.
 * These are based on X11 button codes and common terminal mouse reporting extensions.
 * @property {number} LEFT - Left mouse button (typically button 1).
 * @property {number} MIDDLE - Middle mouse button (typically button 2).
 * @property {number} RIGHT - Right mouse button (typically button 3).
 * @property {number} NONE - Represents no specific button, often used for release events in some protocols.
 * @property {number} RELEASE - Alias for `NONE`, used to signify a button release event.
 * @property {number} BUTTON_1 - Alias for `LEFT`.
 * @property {number} BUTTON_2 - Alias for `MIDDLE`.
 * @property {number} BUTTON_3 - Alias for `RIGHT`.
 * @property {number} WHEEL_UP - Mouse wheel scrolled upwards (typically button 4).
 * @property {number} WHEEL_DOWN - Mouse wheel scrolled downwards (typically button 5).
 * @property {number} WHEEL_LEFT - Mouse wheel scrolled leftwards (typically button 6, less common).
 * @property {number} WHEEL_RIGHT - Mouse wheel scrolled rightwards (typically button 7, less common).
 * @property {number} BACKWARD - Auxiliary button, often browser "Back" (typically button 8).
 * @property {number} FORWARD - Auxiliary button, often browser "Forward" (typically button 9).
 * @property {number} BUTTON_4 - Alias for `WHEEL_UP`.
 * @property {number} BUTTON_5 - Alias for `WHEEL_DOWN`.
 * @property {number} BUTTON_6 - Alias for `WHEEL_LEFT`.
 * @property {number} BUTTON_7 - Alias for `WHEEL_RIGHT`.
 * @property {number} BUTTON_8 - Alias for `BACKWARD`.
 * @property {number} BUTTON_9 - Alias for `FORWARD`.
 * @property {number} BUTTON_10 - Auxiliary button 10.
 * @property {number} BUTTON_11 - Auxiliary button 11.
 * @enum {number}
 */
export const MouseButton = {
    BACKWARD: 8,
    BUTTON_1: 1, // Left
    BUTTON_2: 2, // Middle
    BUTTON_3: 3, // Right
    BUTTON_4: 4, // Wheel Up
    BUTTON_5: 5, // Wheel Down
    BUTTON_6: 6, // Wheel Left
    BUTTON_7: 7, // Wheel Right
    BUTTON_8: 8, // Aux 1 (e.g., Browser Backward)
    BUTTON_9: 9, // Aux 2 (e.g., Browser Forward)
    BUTTON_10: 10, // Aux 3
    BUTTON_11: 11, // Aux 4

    FORWARD: 9,
    // Aliases
    LEFT: 1,
    MIDDLE: 2,
    NONE: 0, // Also used for release if no specific button for release
    RELEASE: 0,
    RIGHT: 3,
    WHEEL_DOWN: 5,
    WHEEL_LEFT: 6,
    WHEEL_RIGHT: 7,
    WHEEL_UP: 4,
} as const;

export type MouseButtonType = (typeof MouseButton)[keyof typeof MouseButton];

/**
 * Interface representing modifier keys (Shift, Alt, Ctrl) that might be active during a mouse event.
 * @property {boolean} [alt] - `true` if the Alt (or Meta) key was pressed, `false` or `undefined` otherwise.
 * @property {boolean} [ctrl] - `true` if the Control key was pressed, `false` or `undefined` otherwise.
 * @property {boolean} [shift] - `true` if the Shift key was pressed, `false` or `undefined` otherwise.
 */
export interface MouseModifiers {
    alt?: boolean; // (Meta)
    ctrl?: boolean;
    shift?: boolean;
}

/**
 * Encodes a mouse button, motion status, and modifiers into a single byte (Cb)
 * for use in X10 and SGR mouse tracking protocols.
 *
 * The encoded byte combines button information, whether it's a motion event,
 * and the state of Shift, Alt, and Ctrl keys.
 * @param button The {@link MouseButtonType} representing the button pressed or wheel action.
 * @param motion `true` if this is a motion event, `false` otherwise.
 * @param modifiers An optional {@link MouseModifiers} object indicating active modifier keys.
 * @returns The encoded byte (Cb). Returns `0xFF` (255) if the provided `button` is invalid or not recognized.
 * @example
 * ```typescript
 * import { encodeMouseButtonByte, MouseButton, MouseModifiers } from \'@visulima/ansi/mouse\';
 *
 * // Left button press, no motion, no modifiers
 * const cb1 = encodeMouseButtonByte(MouseButton.LEFT, false);
 * console.log(cb1); // Output: 0
 *
 * // Middle button press, with motion, Shift key held
 * const cb2 = encodeMouseButtonByte(MouseButton.MIDDLE, true, { shift: true });
 * console.log(cb2); // Output: 37 (Middle=1 + Shift=4 + Motion=32)
 *
 * // Wheel up, no motion, Alt and Ctrl held
 * const cb3 = encodeMouseButtonByte(MouseButton.WHEEL_UP, false, { alt: true, ctrl: true });
 * console.log(cb3); // Output: 88 (WheelUp=0 + WheelFlag=64 + Alt=8 + Ctrl=16)
 *
 * // Release event
 * const cb4 = encodeMouseButtonByte(MouseButton.RELEASE, false);
 * console.log(cb4); // Output: 3
 * ```
 */
export const encodeMouseButtonByte = (button: MouseButtonType, motion: boolean, modifiers: MouseModifiers = {}): number => {
    let callback: number;

    if (button === MouseButton.RELEASE) {
        callback = MOUSE_BUTTON_BITS_MASK; // 3, signifies release for button-press/release style reporting
    } else if (button >= MouseButton.LEFT && button <= MouseButton.RIGHT) {
        callback = button - MouseButton.LEFT;
    } else if (button >= MouseButton.WHEEL_UP && button <= MouseButton.WHEEL_RIGHT) {
        callback = button - MouseButton.WHEEL_UP;
        // eslint-disable-next-line no-bitwise
        callback |= MOUSE_BIT_WHEEL;
    } else if (button >= MouseButton.BACKWARD && button <= MouseButton.BUTTON_11) {
        // Adjust for the fact that BACKWARD (8) is the first in this range
        callback = button - MouseButton.BACKWARD;
        // eslint-disable-next-line no-bitwise
        callback |= MOUSE_BIT_ADDITIONAL;
    } else {
        return 0xFF; // Invalid button
    }

    if (modifiers.shift) {
        // eslint-disable-next-line no-bitwise
        callback |= MOUSE_BIT_SHIFT;
    }

    if (modifiers.alt) {
        // eslint-disable-next-line no-bitwise
        callback |= MOUSE_BIT_ALT;
    }

    if (modifiers.ctrl) {
        // eslint-disable-next-line no-bitwise
        callback |= MOUSE_BIT_CTRL;
    }

    if (motion) {
        // eslint-disable-next-line no-bitwise
        callback |= MOUSE_BIT_MOTION;
    }

    return callback;
};

/**
 * Generates an X10 mouse tracking escape sequence.
 * Format: `CSI M Cb Cx Cy`
 * Where `Cb`, `Cx`, `Cy` are characters derived by adding {@link X10_MOUSE_OFFSET} (32) to the
 * encoded button byte, 1-based X coordinate, and 1-based Y coordinate, respectively.
 *
 * This is an older mouse reporting protocol, primarily reporting button presses.
 * @param callback The encoded button byte, typically from {@link encodeMouseButtonByte}.
 * @param x The 0-indexed X coordinate of the mouse event.
 * @param y The 0-indexed Y coordinate of the mouse event.
 * @returns The X10 mouse sequence string. Returns an empty string if `cb` is `0xFF` (invalid).
 * @example
 * ```typescript
 * import { mouseX10Sequence, encodeMouseButtonByte, MouseButton } from \'@visulima/ansi/mouse\';
 *
 * const cb = encodeMouseButtonByte(MouseButton.LEFT, false);
 * const seq = mouseX10Sequence(cb, 10, 20); // Coordinates are 0-indexed
 * // Result: "\u001b[M!+5" (Cb=0 -> char 32, Cx=11 -> char 43, Cy=21 -> char 53)
 * console.log(seq);
 * ```
 */
export const mouseX10Sequence = (callback: number, x: number, y: number): string => {
    if (callback === 0xFF) {
        return ""; // Don't generate sequence for invalid button byte
    }

    // Coordinates are 1-based for the protocol
    const charCallback = String.fromCharCode(callback + X10_MOUSE_OFFSET);
    const charCx = String.fromCharCode(x + 1 + X10_MOUSE_OFFSET);
    const charCy = String.fromCharCode(y + 1 + X10_MOUSE_OFFSET);

    return `${ESC}[M${charCallback}${charCx}${charCy}`;
};

/**
 * Generates an SGR (Select Graphic Rendition) style mouse tracking escape sequence.
 * This is a more modern and robust mouse reporting format.
 *
 * Format for press/motion: `CSI < Cb ; Px ; Py M`
 * Format for release: `CSI < Cb ; Px ; Py m`
 *
 * `Cb` is the encoded button byte (see {@link encodeMouseButtonByte}).
 * `Px` and `Py` are 1-based X and Y coordinates.
 * @param callback The encoded button byte from {@link encodeMouseButtonByte}.
 * @param x The 0-indexed X coordinate of the mouse event.
 * @param y The 0-indexed Y coordinate of the mouse event.
 * @param isRelease `true` if this is a button release event (sequence ends with `m`),
 * `false` for press or motion events (sequence ends with `M`).
 * @returns The SGR mouse sequence string. Returns an empty string if `cb` is `0xFF` (invalid).
 * @example
 * ```typescript
 * import { mouseSgrSequence, encodeMouseButtonByte, MouseButton } from \'@visulima/ansi/mouse\';
 *
 * // Left button press at (10, 20)
 * const cbPress = encodeMouseButtonByte(MouseButton.LEFT, false);
 * const seqPress = mouseSgrSequence(cbPress, 10, 20, false);
 * console.log(seqPress); // Output: "\u001b[<0;11;21M"
 *
 * // Left button release at (10, 20)
 * const cbRelease = encodeMouseButtonByte(MouseButton.RELEASE, false); // Or use original button with isRelease=true
 * const seqRelease = mouseSgrSequence(cbPress, 10, 20, true); // cbPress (0) is fine for release with SGR if button info isn't needed for release
 * console.log(seqRelease); // Output: "\u001b[<0;11;21m"
 * // If using explicit release button code from encodeMouseButtonByte:
 * const cbExplicitRelease = encodeMouseButtonByte(MouseButton.RELEASE, false);
 * const seqExplicitRelease = mouseSgrSequence(cbExplicitRelease, 10, 20, true);
 * console.log(seqExplicitRelease); // Output: "\u001b[<3;11;21m"
 *
 * // Motion with middle button and Shift key at (5,5)
 * const cbMotion = encodeMouseButtonByte(MouseButton.MIDDLE, true, { shift: true });
 * const seqMotion = mouseSgrSequence(cbMotion, 5, 5, false);
 * console.log(seqMotion); // Output: "\u001b[<37;6;6M"
 * ```
 */
export const mouseSgrSequence = (callback: number, x: number, y: number, isRelease: boolean): string => {
    if (callback === 0xFF) {
        return ""; // Don't generate sequence for invalid button byte
    }

    // Coordinates are 1-based for the protocol
    const finalChar = isRelease ? "m" : "M";

    return `${ESC}[<${callback};${x + 1};${y + 1}${finalChar}`;
};

// Mouse Reporting Mode Control Sequences
// See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking

/**
 * Enables X10 compatibility mouse reporting (DECSET 9).
 * This is an older protocol that typically reports only button press events.
 * The format is `CSI M Cb Cx Cy`.
 * @see {@link disableX10Mouse}
 * @see {@link mouseX10Sequence}
 */
export const enableX10Mouse: string = `${ESC}[?9h`;

/**
 * Disables X10 compatibility mouse reporting (DECRST 9).
 * @see {@link enableX10Mouse}
 */
export const disableX10Mouse: string = `${ESC}[?9l`;

/**
 * Enables Normal Tracking mode, also known as VT200 mouse reporting (DECSET 1000).
 * Reports button press and release events.
 * Uses X10-style coordinate encoding if SGR mode is not also active.
 * @see {@link disableNormalMouse}
 */
export const enableNormalMouse: string = `${ESC}[?1000h`;

/**
 * Disables Normal Tracking mode / VT200 mouse reporting (DECRST 1000).
 * @see {@link enableNormalMouse}
 */
export const disableNormalMouse: string = `${ESC}[?1000l`;

/**
 * Enables Button-Event tracking mouse reporting (DECSET 1002).
 * Reports press, release, and mouse motion when a button is held down.
 * @see {@link disableButtonEventMouse}
 */
export const enableButtonEventMouse: string = `${ESC}[?1002h`;

/**
 * Disables Button-Event tracking mouse reporting (DECRST 1002).
 * @see {@link enableButtonEventMouse}
 */
export const disableButtonEventMouse: string = `${ESC}[?1002l`;

/**
 * Enables Any-Event mouse reporting (DECSET 1003).
 * Reports press, release, and all mouse motion (including hover when no buttons are pressed).
 * This is the most comprehensive mouse motion tracking mode (excluding pixel-level reporting).
 * @see {@link disableAnyEventMouse}
 */
export const enableAnyEventMouse: string = `${ESC}[?1003h`;

/**
 * Disables Any-Event mouse reporting (DECRST 1003).
 * @see {@link enableAnyEventMouse}
 */
export const disableAnyEventMouse: string = `${ESC}[?1003l`;

/**
 * Enables SGR (Select Graphic Rendition) Extended mouse reporting (DECSET 1006).
 * Event data is sent in a more robust format: `CSI < Cb ; Px ; Py M` (press) or `m` (release).
 * This mode is generally preferred for new applications due to its clarity and ability
 * to handle coordinates larger than 95 without ambiguity with UTF-8 characters.
 * @see {@link disableSgrMouse}
 * @see {@link mouseSgrSequence}
 */
export const enableSgrMouse: string = `${ESC}[?1006h`;

/**
 * Disables SGR Extended mouse reporting (DECRST 1006).
 * @see {@link enableSgrMouse}
 */
export const disableSgrMouse: string = `${ESC}[?1006l`;

/**
 * Enables FocusIn/FocusOut event reporting (DECSET 1004).
 * The terminal will send `CSI I` when it gains focus and `CSI O` when it loses focus.
 * @see {@link disableFocusTracking}
 */
export const enableFocusTracking: string = `${ESC}[?1004h`;

/**
 * Disables FocusIn/FocusOut event reporting (DECRST 1004).
 * @see {@link enableFocusTracking}
 */
export const disableFocusTracking: string = `${ESC}[?1004l`;
