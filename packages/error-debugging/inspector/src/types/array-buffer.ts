import type { InspectType, Options } from "../types";

/**
 * Renders `ArrayBuffer` / `SharedArrayBuffer` values, mirroring `util.inspect`'s
 * `ArrayBuffer { [Uint8Contents]: ..., byteLength: N }` shape. The byte contents
 * are shown as space-separated, zero-padded hex pairs and truncated to a small,
 * bounded number of bytes so a multi-megabyte buffer never floods the output.
 */
const MAX_BYTES_SHOWN = 50;

const inspectArrayBuffer: InspectType<ArrayBuffer> = (buffer: ArrayBuffer, options: Options): string => {
    const view = new Uint8Array(buffer);
    const shown = Math.min(view.length, MAX_BYTES_SHOWN);

    let hex = "";

    for (let index = 0; index < shown; index += 1) {
        hex += (index === 0 ? "" : " ") + (view[index] as number).toString(16).padStart(2, "0");
    }

    if (view.length > shown) {
        hex += ` ... ${String(view.length - shown)} more byte${view.length - shown === 1 ? "" : "s"}`;
    }

    const name = buffer instanceof ArrayBuffer ? "ArrayBuffer" : "SharedArrayBuffer";
    const contents = hex === "" ? "" : `[Uint8Contents]: <${hex}>, `;

    return `${options.stylize(name, "special")} { ${contents}byteLength: ${options.stylize(String(buffer.byteLength), "number")} }`;
};

export default inspectArrayBuffer;
