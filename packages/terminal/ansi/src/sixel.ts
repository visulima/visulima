import { DCS, ST } from "./constants";

/**
 * Wraps a pre-encoded Sixel `payload` in the Sixel graphics device-control
 * string (`DCS … q … ST`).
 *
 * This is an emit-only helper: it does **not** encode pixel data into Sixel
 * format, it only frames already-encoded Sixel data so it can be written to a
 * Sixel-capable terminal. Pass a negative value for `aspectRatio`/`backgroundMode`
 * to omit that parameter and a non-positive value for `gridSize` to omit it.
 *
 * Sequence: `DCS aspectRatio ; backgroundMode ; gridSize q payload ST`
 * @param aspectRatio The pixel aspect ratio macro parameter (omitted when negative).
 * @param backgroundMode The background color / transparency mode (omitted when negative).
 * @param gridSize The grid size (omitted when not positive).
 * @param payload The already-encoded Sixel data.
 * @returns The Sixel `DCS` escape sequence.
 * @see {@link https://vt100.net/docs/vt3xx-gp/chapter14.html}
 */
const sixelGraphics = (aspectRatio: number, backgroundMode: number, gridSize: number, payload: string): string => {
    const aspect = aspectRatio >= 0 ? String(aspectRatio) : "";
    const background = backgroundMode >= 0 ? String(backgroundMode) : "";
    const grid = gridSize > 0 ? `;${String(gridSize)}` : "";

    return `${DCS}${aspect};${background}${grid}q${payload}${ST}`;
};

export default sixelGraphics;
