/**
 * Public canvas surface (`@visulima/tui/canvas`).
 *
 * Registry components are copied into consumer repos and therefore cannot
 * reach into `src/ink/**` the way the in-tree components used to. Everything
 * a copied component needs to paint a canvas is re-exported here, and this
 * barrel is part of the package's public API contract: treat the signatures
 * below as stable and version them accordingly.
 *
 * The `Canvas` React component itself lives at `@visulima/tui/components/canvas`
 * — this entry is the imperative layer beneath it.
 */
export type { BrailleGrid } from "./braille";
export { createBrailleGrid } from "./braille";
export type { CanvasBuffer, CanvasColor, CanvasContext, CellStyle } from "./buffer";
export { createCanvasBuffer, serializeRow } from "./buffer";
