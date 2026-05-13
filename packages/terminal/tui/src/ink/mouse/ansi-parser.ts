/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 *
 * Rewritten to use a unified SGR 1006 parser with full button support.
 */

/* eslint-disable no-bitwise */
import { SGR_MOUSE_PATTERN } from "./constants";
import type { MouseButton } from "./mouse-context";

type SgrMouseEvent
    = | { action: "press" | "release"; button: MouseButton; type: "click"; x: number; y: number }
        | { action: "press" | "release"; button: MouseButton; type: "drag"; x: number; y: number }
        | { type: "move"; x: number; y: number }
        | { direction: "scrolldown" | "scrollup"; type: "scroll"; x: number; y: number };

const CLICK_BUTTONS: Record<number, MouseButton> = { 0: "left", 1: "middle", 2: "right" };
const DRAG_BUTTONS: Record<number, MouseButton> = { 32: "left", 33: "middle", 34: "right" };

/**
 * Parse an SGR 1006 mouse escape sequence into a structured event.
 *
 * Returns `undefined` if the input is not a valid SGR mouse sequence.
 */
const parseSgrMouse = (input: string): SgrMouseEvent | undefined => {
    const match = SGR_MOUSE_PATTERN.exec(input);

    if (!match) {
        return undefined;
    }

    const rawButton = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    const isRelease = match[4] === "m";

    // Strip modifier bits: shift=4, meta=8, ctrl=16
    const base = rawButton & ~(4 | 8 | 16);

    // Scroll: base 64=scrollUp, 65=scrollDown
    if (base === 64 || base === 65) {
        return { direction: base === 64 ? "scrollup" : "scrolldown", type: "scroll", x, y };
    }

    // Motion without button: base 35
    if (base === 35) {
        return { type: "move", x, y };
    }

    // Drag: base 32=left, 33=middle, 34=right
    const dragButton = DRAG_BUTTONS[base];

    if (dragButton) {
        return { action: isRelease ? "release" : "press", button: dragButton, type: "drag", x, y };
    }

    // Click: base 0=left, 1=middle, 2=right
    const clickButton = CLICK_BUTTONS[base];

    if (clickButton) {
        return { action: isRelease ? "release" : "press", button: clickButton, type: "click", x, y };
    }

    return undefined;
};

export { parseSgrMouse };
export type { SgrMouseEvent };
