/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

const ANSI_CODES = {
    // SET_ALTERNATE_SCROLL
    alternateScroll: { off: "\u001B[?1007l", on: "\u001B[?1007h" },

    // SET_VT200_MOUSE - Terminal will send event on button pressed with mouse position
    mouseButton: { off: "\u001B[?1000l", on: "\u001B[?1000h" },

    // SET_BTN_EVENT_MOUSE - Terminal will send event on button pressed and mouse motion as long as a button is down
    mouseDrag: { off: "\u001B[?1002l", on: "\u001B[?1002h" },

    // SET_FOCUS_EVENT_MOUSE
    mouseFocus: { off: "\u001B[?1004l", on: "\u001B[?1004h" },

    // SET_VT200_HIGHLIGHT_MOUSE - Terminal will send position of the column highlighted
    mouseHighlight: { off: "\u001B[?1001l", on: "\u001B[?1001h" },

    // SET_ANY_EVENT_MOUSE - Terminal will send event on button pressed and motion
    mouseMotion: { off: "\u001B[?1003l", on: "\u001B[?1003h" },

    // SET_URXVT_EXT_MODE_MOUSE
    mouseMotionOthers: { off: "\u001B[?1015l", on: "\u001B[?1015h" },

    // SET_PIXEL_POSITION_MOUSE
    mousePixelMode: { off: "\u001B[?1016l", on: "\u001B[?1016h" },

    // SET_SGR_EXT_MODE_MOUSE - Another mouse protocol that extends coordinate mapping (without it, supports only 223 rows and columns)
    mouseSGR: { off: "\u001B[?1006l", on: "\u001B[?1006h" },

    // SET_EXT_MODE_MOUSE
    mouseUtf8: { off: "\u001B[?1005l", on: "\u001B[?1005h" },

    // SET_X10_MOUSE
    mouseX10: { off: "\u001B[?9l", on: "\u001B[?9h" },
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
