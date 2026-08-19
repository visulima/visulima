import x11ColorToHex from "./x11-colors";

/** A colour resolved to 8-bit channels. */
interface Rgb {
    b: number;
    g: number;
    r: number;
}

/** `rgb:` and `rgba:` device specifications, 1–4 hex digits per channel. */
const RE_RGB_SPEC = /^rgba?:([\da-f]{1,4})\/([\da-f]{1,4})\/([\da-f]{1,4})(?:\/[\da-f]{1,4})?$/i;

/** `#rgb`, `#rrggbb`, `#rrrggggbbb` and `#rrrrggggbbbb`. */
const RE_HASH_SPEC = /^#((?:[\da-f]{3}){1,4})$/i;

/**
 * Scales a channel written with `digits` hex digits down to 8 bits.
 *
 * X11 device specifications are resolution-independent: `f`, `ff`, `fff` and `ffff` all mean "full
 * intensity", so a channel is scaled by its own width rather than truncated.
 * @param value The channel's hex digits.
 * @returns The channel as 0–255.
 */
const toByte = (value: string): number => {
    const scale = 16 ** value.length - 1;

    return Math.round((Number.parseInt(value, 16) / scale) * 255);
};

/**
 * Parses a colour as OSC 10/11/12 and `xparsecolor` accept it.
 *
 * Terminals are inconsistent about how they answer a colour query: `rgb:` device specifications are
 * the documented form, but `#rrggbb` and bare X11 names both occur in the wild. Accepting all three
 * means a caller reading a reply does not have to guess which terminal it is talking to.
 * @param spec The colour specification.
 * @returns The colour, or `undefined` when `spec` is not a colour.
 * @example
 * ```typescript
 * import { parseColor } from "@visulima/ansi";
 *
 * parseColor("rgb:ffff/0000/0000"); // { b: 0, g: 0, r: 255 }
 * parseColor("#ff0000");            // { b: 0, g: 0, r: 255 }
 * parseColor("CornflowerBlue");     // { b: 237, g: 149, r: 100 }
 * ```
 */
const parseColor = (spec: string): Rgb | undefined => {
    const trimmed = spec.trim();

    const device = RE_RGB_SPEC.exec(trimmed);

    if (device) {
        return { b: toByte(device[3] as string), g: toByte(device[2] as string), r: toByte(device[1] as string) };
    }

    const named = trimmed.startsWith("#") ? trimmed : x11ColorToHex(trimmed);

    if (named === undefined) {
        return undefined;
    }

    const hash = RE_HASH_SPEC.exec(named);

    if (!hash) {
        return undefined;
    }

    const digits = hash[1] as string;
    const width = digits.length / 3;

    return {
        b: toByte(digits.slice(width * 2)),
        g: toByte(digits.slice(width, width * 2)),
        r: toByte(digits.slice(0, width)),
    };
};

export type { Rgb };
export default parseColor;
export { parseColor };
