import { DCS, ST } from "./constants";

/**
 * Wraps a pre-encoded Sixel `payload` in the Sixel graphics device-control
 * string (`DCS … q … ST`).
 *
 * This is an emit-only helper: it does **not** encode pixel data into Sixel
 * format, it only frames already-encoded Sixel data so it can be written to a
 * Sixel-capable terminal. Pass a negative value for `p1`/`p2` to omit that
 * parameter and `0` (or a negative value) for `p3` to omit the grid size.
 *
 * Sequence: `DCS p1 ; p2 ; p3 q payload ST`
 * @param p1 The pixel aspect ratio macro parameter (omitted when negative).
 * @param p2 The background color / transparency mode (omitted when negative).
 * @param p3 The grid size (omitted when not positive).
 * @param payload The already-encoded Sixel data.
 * @returns The Sixel `DCS` escape sequence.
 * @see {@link https://vt100.net/docs/vt3xx-gp/chapter14.html}
 */
const sixelGraphics = (p1: number, p2: number, p3: number, payload: string): string => {
    const aspect = p1 >= 0 ? String(p1) : "";
    const background = p2 >= 0 ? String(p2) : "";
    const grid = p3 > 0 ? `;${String(p3)}` : "";

    return `${DCS}${aspect};${background}${grid}q${payload}${ST}`;
};

export default sixelGraphics;
