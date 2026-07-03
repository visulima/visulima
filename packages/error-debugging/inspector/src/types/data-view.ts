import type { InspectType, Options } from "../types";

/**
 * Renders `DataView` values, mirroring `util.inspect`'s
 * `DataView { byteLength: N, byteOffset: M, buffer: ArrayBuffer { byteLength: K } }`
 * shape without recursing into the (potentially huge) backing buffer contents.
 */
const inspectDataView: InspectType<DataView> = (view: DataView, options: Options): string => {
    const byteLength = options.stylize(String(view.byteLength), "number");
    const byteOffset = options.stylize(String(view.byteOffset), "number");
    const bufferByteLength = options.stylize(String(view.buffer.byteLength), "number");

    return `${options.stylize("DataView", "special")} { byteLength: ${byteLength}, byteOffset: ${byteOffset}, buffer: ArrayBuffer { byteLength: ${bufferByteLength} } }`;
};

export default inspectDataView;
