import type { State } from "../types";
import copyArrayBuffer from "./copy-array-buffer";

const copyDataView = <Value extends DataView>(dataView: Value, state: State): Value => {
    const { buffer } = dataView;

    if (buffer instanceof SharedArrayBuffer) {
        throw new TypeError("SharedArrayBuffer cannot be cloned");
    }

    // Share a single clone of the underlying buffer with any other view (or raw
    // buffer reference) in the graph so their identity is preserved.
    let copiedBuffer = state.cache.get(buffer) as ArrayBuffer | undefined;

    if (copiedBuffer === undefined) {
        copiedBuffer = copyArrayBuffer(buffer);

        state.cache.set(buffer, copiedBuffer);
    }

    return new DataView(copiedBuffer, dataView.byteOffset, dataView.byteLength) as Value;
};

export default copyDataView;
