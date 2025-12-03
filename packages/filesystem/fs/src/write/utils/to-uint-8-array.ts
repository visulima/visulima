const encoder = new TextEncoder();

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
const toUint8Array = (contents: any): Uint8Array => {
    if (contents instanceof Uint8Array) {
        return contents;
    }

    if (typeof contents === "string") {
        return encoder.encode(contents);
    }

    if (contents instanceof ArrayBuffer) {
        return new Uint8Array(contents);
    }

    if (ArrayBuffer.isView(contents)) {
        const bytes = contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength);

        return new Uint8Array(bytes);
    }

    throw new TypeError("Invalid contents type. Expected string or ArrayBuffer.");
};

export default toUint8Array;
