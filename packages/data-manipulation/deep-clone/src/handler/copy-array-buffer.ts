/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call */
import type { TypedArray } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const typeHandlers: Record<string, new (buffer: any) => any> = {
    BigInt64Array,
    BigUint64Array,
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

// `Buffer` only exists in Node-like runtimes. Reference the global lazily/guarded
// so that importing this module in a browser or edge runtime (where `Buffer` is
// undefined) does not throw a `ReferenceError` at evaluation time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cloneBuffer = (value: any): any => Buffer.from(value);

const copyArrayBuffer = <Value extends ArrayBuffer | ArrayBufferView | Buffer | TypedArray>(arrayBuffer: Value): Value => {
    if (arrayBuffer instanceof ArrayBuffer) {
        const newBuffer = new ArrayBuffer(arrayBuffer.byteLength);
        const origView = new Uint8Array(arrayBuffer);
        const newView = new Uint8Array(newBuffer);

        newView.set(origView);

        return newBuffer as Value;
    }

    const constructorName = arrayBuffer.constructor.name;

    if (constructorName === "Buffer" && typeof Buffer !== "undefined") {
        return cloneBuffer(arrayBuffer) as Value;
    }

    const Ctor = typeHandlers[constructorName] ?? undefined;

    if (Ctor) {
        return new Ctor(arrayBuffer);
    }

    const Ctor2 = (arrayBuffer as ArrayBufferView).constructor;
    const buf = copyArrayBuffer(arrayBuffer.buffer as ArrayBuffer);

    // @ts-expect-error - Fallback to ArrayBufferView, constructor is not typed as newable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
    return new Ctor2(buf, arrayBuffer.byteOffset, (arrayBuffer as any).length);
};

export default copyArrayBuffer;
