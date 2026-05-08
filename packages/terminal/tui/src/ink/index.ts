/**
 * Public API for the `@visulima/tui` ink entry point.
 *
 * Components and hooks have moved to dedicated subpaths
 * (`@visulima/tui/components/<name>` and `@visulima/tui/hooks/<name>`); this
 * file now exposes only lower-level primitives (clipboard, DOM helpers,
 * layout, measurement, mouse, render, scroll, terminal palette, …).
 */

// --- Clipboard --------------------------------------------------------------

export type { ClipboardTarget } from "./clipboard";
export { clearOsc52, isOsc52Supported, writeOsc52 } from "./clipboard";

// --- Color primitives -------------------------------------------------------

export type { ColorBlindnessType, ColorMatrix } from "./color-matrix";
export {
    applyColorMatrix,
    COLOR_BLINDNESS_COMPENSATION,
    COLOR_BLINDNESS_SIMULATION,
    hexToRgb,
    IDENTITY_MATRIX,
    rgbToHex,
    transformHexColor,
} from "./color-matrix";

// --- DOM helpers ------------------------------------------------------------

export type { DOMElement, StickyHeader } from "./dom";

// --- DOM helpers ------------------------------------------------------------

export { getPathToRoot, isNodeSelectable } from "./dom";

// --- IME --------------------------------------------------------------------

export { IMECompositionBuffer, isIMEInput } from "./ime-utils";

// --- Kitty keyboard ---------------------------------------------------------

export type { KittyFlagName, KittyKeyboardOptions } from "./kitty-keyboard";
export { kittyFlags, kittyModifiers } from "./kitty-keyboard";

// --- Layout -----------------------------------------------------------------

export type { LayoutCallbacks } from "./layout";
export { processLayout } from "./layout";
export type { CursorPosition } from "./log-update";

// --- Measurement ------------------------------------------------------------

export type { ScrollbarBoundingBox, TextFragment } from "./measure-element";
export { default as measureElement } from "./measure-element";
export {
    calculateScrollbarLayout,
    calculateScrollbarThumb,
    collectSortedFragments,
    getAddedScrollHeight,
    getBoundingBox,
    getHorizontalScrollbarBoundingBox,
    getInnerHeight,
    getInnerWidth,
    getRelativeLeft,
    getRelativeTop,
    getText,
    getVerticalScrollbarBoundingBox,
} from "./measure-element";
export type { StringWidthFunction } from "./measure-text";
export { clearStringWidthCache, clearStyledLineCache, inkCharacterWidth, setEnableStyledLineCache, setStringWidthFunction, toStyledLine } from "./measure-text";

// --- Mouse ------------------------------------------------------------------

export type {
    MouseAction,
    MouseButton,
    MouseClickAction,
    MouseContextShape,
    MouseDragAction,
    MouseEvents,
    MousePosition,
    MouseScrollAction,
    SgrMouseEvent,
    UseOnMouseClickOptions,
} from "./mouse/index";
export {
    Fullscreen,
    isIntersecting,
    MouseProvider,
    parseSgrMouse,
    useElementDimensions,
    useElementPosition,
    useMouseAction,
    useMouseContext,
    useMousePosition,
    useOnMouseClick,
    useOnMouseHover,
    useOnMouseState,
} from "./mouse/index";

// --- Render & output --------------------------------------------------------

export type { Instance, RenderOptions } from "./render";
export { default as render } from "./render";
export type { RenderToStringOptions } from "./render-to-string";
export { default as renderToString } from "./render-to-string";
export type { ResizeObserverCallback } from "./resize-observer";
export { default as ResizeObserver, ResizeObserverEntry } from "./resize-observer";

// --- Scroll & selection -----------------------------------------------------

export type { ScrollState } from "./scroll";
export { calculateScroll, getScrollHeight, getScrollLeft, getScrollTop, getScrollWidth } from "./scroll";
export { applySelectionToStyledLine, comparePoints, Range, Selection } from "./selection";
export type { CharOffsetMap, CharOffsetRange } from "./squash-text-nodes";
export { squashTextNodesWithMap } from "./squash-text-nodes";

// --- Terminal palette / text ------------------------------------------------

export type { TerminalPalette } from "./terminal-palette";
export { isTerminalPaletteQuerySupported, queryTerminalPalette } from "./terminal-palette";
export { wrapOrTruncateStyledLine } from "./text-wrap";
