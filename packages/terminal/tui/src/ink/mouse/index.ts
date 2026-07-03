/**
 * Mouse tracking for terminal UIs.
 *
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

export type { SgrMouseEvent } from "./ansi-parser";
export { parseSgrMouse } from "./ansi-parser";
export { default as Fullscreen } from "./fullscreen";
export { default as isIntersecting } from "./is-intersecting";
export type {
    MouseAction,
    MouseButton,
    MouseClickAction,
    MouseContextShape,
    MouseDragAction,
    MouseEvents,
    MousePosition,
    MouseScrollAction,
} from "./mouse-context";
export { default as MouseProvider } from "./mouse-provider";
export { useElementDimensions, useElementPosition } from "./use-element-position";
export { default as useMouseContext } from "./use-mouse";
export { default as useMouseAction } from "./use-mouse-action";
export { default as useMousePosition } from "./use-mouse-position";
export type { UseOnMouseClickOptions } from "./use-on-mouse-click";
export { useOnMouseClick } from "./use-on-mouse-click";
export { default as useOnMouseHover } from "./use-on-mouse-hover";
export { default as useOnMouseState } from "./use-on-mouse-state";
