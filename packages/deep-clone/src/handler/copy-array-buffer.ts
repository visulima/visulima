import type { TypedArray } from "../types";

const copyArrayBuffer = <Value extends ArrayBuffer | ArrayBufferView | Buffer | TypedArray>(arrayBuffer: Value): Value => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeHandlers: Record<string, new (buffer: any) => any> = {
        BigInt64Array,
        BigUint64Array,
        // @ts-expect-error - Buffer has no constructor

        Buffer: Buffer.from,
        Float32Array,
        Float64Array,
        Int8Array,
        Int16Array,
        Int32Array,
        Uint8Array,
        Uint8ClampedArray,
        Uint16Array,
        Uint32Array,
    };

    if (arrayBuffer instanceof ArrayBuffer) {
        const newBuffer = new ArrayBuffer(arrayBuffer.byteLength);
        const origView = new Uint8Array(arrayBuffer);
        const newView = new Uint8Array(newBuffer);

        newView.set(origView);

        return newBuffer as Value;
    }

    const Ctor = typeHandlers[arrayBuffer.constructor.name] ?? undefined;

    if (Ctor) {
        return new Ctor(arrayBuffer);
    }

    // @ts-expect-error - Fallback to ArrayBufferView

    return new (arrayBuffer as ArrayBufferView).constructor([...arrayBuffer.buffer], arrayBuffer.byteOffset, arrayBuffer.length);
};

export default copyArrayBuffer;
