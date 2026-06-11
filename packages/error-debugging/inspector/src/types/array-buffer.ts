import type { InspectType, Options } from "../types";

/**
 * Renders `ArrayBuffer` / `SharedArrayBuffer` values close to `util.inspect`'s
 * `ArrayBuffer { [Uint8Contents]: ..., byteLength: N }` shape. The byte contents
 * are shown as space-separated, zero-padded hex pairs and truncated to a small,
 * bounded number of bytes so a multi-megabyte buffer never floods the output.
 * A freshly-allocated (all-zero) or empty buffer omits the `[Uint8Contents]`
 * field and renders as just `ArrayBuffer { byteLength: N }`.
 */
const MAX_BYTES_SHOWN = 50;

const inspectArrayBuffer: InspectType<ArrayBuffer> = (buffer: ArrayBuffer, options: Options): string => {
    const view = new Uint8Array(buffer);
    const shown = Math.min(view.length, MAX_BYTES_SHOWN);

    let hex = "";
    let hasNonZeroByte = false;

    for (let index = 0; index < shown; index += 1) {
        const byte = view[index] as number;

        if (byte !== 0) {
            hasNonZeroByte = true;
        }

        hex += (index === 0 ? "" : " ") + byte.toString(16).padStart(2, "0");
    }

    if (view.length > shown) {
        hex += ` ... ${String(view.length - shown)} more byte${view.length - shown === 1 ? "" : "s"}`;
    }

    const name = buffer instanceof ArrayBuffer ? "ArrayBuffer" : "SharedArrayBuffer";
    // Only surface the raw byte contents when there is something meaningful to
    // show: a freshly-allocated (all-zero) or empty buffer renders as just its
    // byteLength, while a buffer with real data shows its `[Uint8Contents]`.
    const showContents = hasNonZeroByte || view.length > shown;
    const contents = hex !== "" && showContents ? `[Uint8Contents]: <${hex}>, ` : "";

    return `${options.stylize(name, "special")} { ${contents}byteLength: ${options.stylize(String(buffer.byteLength), "number")} }`;
};

export default inspectArrayBuffer;
