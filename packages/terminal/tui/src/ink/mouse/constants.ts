/**
 * Ported from @zenobius/ink-mouse (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

const ANSI_CODES = {
    // SET_ALTERNATE_SCROLL
    alternateScroll: { off: "\x1b[?1007l", on: "\x1b[?1007h" },

    // SET_VT200_MOUSE - Terminal will send event on button pressed with mouse position
    mouseButton: { off: "\x1b[?1000l", on: "\x1b[?1000h" },

    // SET_BTN_EVENT_MOUSE - Terminal will send event on button pressed and mouse motion as long as a button is down
    mouseDrag: { off: "\x1b[?1002l", on: "\x1b[?1002h" },

    // SET_FOCUS_EVENT_MOUSE
    mouseFocus: { off: "\x1b[?1004l", on: "\x1b[?1004h" },

    // SET_VT200_HIGHLIGHT_MOUSE - Terminal will send position of the column highlighted
    mouseHighlight: { off: "\x1b[?1001l", on: "\x1b[?1001h" },

    // SET_ANY_EVENT_MOUSE - Terminal will send event on button pressed and motion
    mouseMotion: { off: "\x1b[?1003l", on: "\x1b[?1003h" },

    // SET_URXVT_EXT_MODE_MOUSE
    mouseMotionOthers: { off: "\x1b[?1015l", on: "\x1b[?1015h" },

    // SET_PIXEL_POSITION_MOUSE
    mousePixelMode: { off: "\x1b[?1016l", on: "\x1b[?1016h" },

    // SET_SGR_EXT_MODE_MOUSE - Another mouse protocol that extends coordinate mapping (without it, supports only 223 rows and columns)
    mouseSGR: { off: "\x1b[?1006l", on: "\x1b[?1006h" },

    // SET_EXT_MODE_MOUSE
    mouseUtf8: { off: "\x1b[?1005l", on: "\x1b[?1005h" },

    // SET_X10_MOUSE
    mouseX10: { off: "\x1b[?9l", on: "\x1b[?9h" },
};

/**
 * Unified SGR 1006 mouse sequence pattern.
 *
 * Captures: (buttonCode) (x) (y) (M|m)
 * - M = press/motion, m = release
 * - Button code includes modifier bits (shift=+4, meta=+8, ctrl=+16)
 */
const SGR_MOUSE_PATTERN: RegExp = /\[<(\d+);(\d+);(\d+)([Mm])$/;

export { ANSI_CODES, SGR_MOUSE_PATTERN };
