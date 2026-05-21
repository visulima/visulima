/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */
import {
    disableAnyEventMouse,
    disableButtonEventMouse,
    disableFocusTracking,
    disableNormalMouse,
    disableSgrMouse,
    disableX10Mouse,
    enableAnyEventMouse,
    enableButtonEventMouse,
    enableFocusTracking,
    enableNormalMouse,
    enableSgrMouse,
    enableX10Mouse,
} from "@visulima/ansi";

type AnsiCodeKey =
    | "alternateScroll"
    | "mouseButton"
    | "mouseDrag"
    | "mouseFocus"
    | "mouseHighlight"
    | "mouseMotion"
    | "mouseMotionOthers"
    | "mousePixelMode"
    | "mouseSGR"
    | "mouseUtf8"
    | "mouseX10";

const ANSI_CODES: Record<AnsiCodeKey, { off: string; on: string }> = {
    // SET_ALTERNATE_SCROLL — no dedicated helper in @visulima/ansi
    alternateScroll: { off: "\u001B[?1007l", on: "\u001B[?1007h" },

    // SET_VT200_MOUSE - Terminal will send event on button pressed with mouse position
    mouseButton: { off: disableNormalMouse, on: enableNormalMouse },

    // SET_BTN_EVENT_MOUSE - Terminal will send event on button pressed and mouse motion as long as a button is down
    mouseDrag: { off: disableButtonEventMouse, on: enableButtonEventMouse },

    // SET_FOCUS_EVENT_MOUSE
    mouseFocus: { off: disableFocusTracking, on: enableFocusTracking },

    // SET_VT200_HIGHLIGHT_MOUSE - Terminal will send position of the column highlighted — no dedicated helper in @visulima/ansi
    mouseHighlight: { off: "\u001B[?1001l", on: "\u001B[?1001h" },

    // SET_ANY_EVENT_MOUSE - Terminal will send event on button pressed and motion
    mouseMotion: { off: disableAnyEventMouse, on: enableAnyEventMouse },

    // SET_URXVT_EXT_MODE_MOUSE — no dedicated helper in @visulima/ansi
    mouseMotionOthers: { off: "\u001B[?1015l", on: "\u001B[?1015h" },

    // SET_PIXEL_POSITION_MOUSE — no dedicated helper in @visulima/ansi
    mousePixelMode: { off: "\u001B[?1016l", on: "\u001B[?1016h" },

    // SET_SGR_EXT_MODE_MOUSE - Another mouse protocol that extends coordinate mapping (without it, supports only 223 rows and columns)
    mouseSGR: { off: disableSgrMouse, on: enableSgrMouse },

    // SET_EXT_MODE_MOUSE — no dedicated helper in @visulima/ansi
    mouseUtf8: { off: "\u001B[?1005l", on: "\u001B[?1005h" },

    // SET_X10_MOUSE
    mouseX10: { off: disableX10Mouse, on: enableX10Mouse },
};

/**
 * Unified SGR 1006 mouse sequence pattern.
 *
 * Captures: (buttonCode) (x) (y) (M|m)
 * - M = press/motion, m = release
 * - Button code includes modifier bits (shift=+4, meta=+8, ctrl=+16)
 */
const SGR_MOUSE_PATTERN: RegExp = /\[<(\d+);(\d+);(\d+)(M)$/i;

export { ANSI_CODES, SGR_MOUSE_PATTERN };
