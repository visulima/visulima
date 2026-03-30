/**
 * Mouse tracking for terminal UIs.
 *
 * Ported from @zenobius/ink-mouse (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

export { parseSgrMouse } from "./ansi-parser";
export type { SgrMouseEvent } from "./ansi-parser";
export { Fullscreen } from "./Fullscreen";
export { isIntersecting } from "./is-intersecting";
export type { MouseAction, MouseButton, MouseClickAction, MouseContextShape, MouseDragAction, MouseEvents, MousePosition, MouseScrollAction } from "./mouse-context";
export { MouseProvider } from "./MouseProvider";
export { useElementDimensions, useElementPosition } from "./use-element-position";
export { useMouseContext } from "./use-mouse";
export { useMouseAction } from "./use-mouse-action";
export { useMousePosition } from "./use-mouse-position";
export { useOnMouseClick } from "./use-on-mouse-click";
export type { UseOnMouseClickOptions } from "./use-on-mouse-click";
export { useOnMouseHover } from "./use-on-mouse-hover";
export { useOnMouseState } from "./use-on-mouse-state";
