import { APC, ST } from "./constants";

/**
 * Wraps a Kitty graphics protocol `payload` in the APC frame the protocol uses
 * (`APC _ G options ; payload ST`).
 *
 * This is an emit-only helper: it frames a (typically Base64-encoded) `payload`
 * together with the control `options`. It does **not** encode image data or
 * split large payloads into chunks — the caller is responsible for Base64
 * encoding and chunking (using the `m=1`/`m=0` options) when needed.
 *
 * Sequence: `APC _ G options ; payload ST`
 * @param payload The (already-encoded) image/control payload. May be empty for control-only sequences.
 * @param options The control options as `key=value` strings, joined with `,` (e.g. `"a=T"`, `"f=100"`).
 * @returns The Kitty graphics `APC` escape sequence.
 * @see {@link https://sw.kovidgoyal.net/kitty/graphics-protocol/}
 */
const kittyGraphics = (payload: string, ...options: string[]): string => {
    const data = payload.length > 0 ? `;${payload}` : "";

    return `${APC}G${options.join(",")}${data}${ST}`;
};

export default kittyGraphics;
