const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Converts content to a base64-encoded string.
 * Works across Node.js, Deno, Bun, and Workers.
 * @param content The content to convert (string, Buffer, or Uint8Array).
 * @returns The base64-encoded string.
 */
const toBase64 = (content: string | Buffer | Uint8Array): string => {
    if (typeof content === "string") {
        if (hasBuffer) {
            return Buffer.from(content, "utf8").toString("base64");
        }

        const encoder = new TextEncoder();
        const bytes = encoder.encode(content);

        // Convert in chunks to avoid stack overflow for large inputs
        let binaryString = "";
        const chunkSize = 8192;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));

            // eslint-disable-next-line unicorn/prefer-code-point -- fromCharCode is correct for binary data
            binaryString += String.fromCharCode.apply(undefined, chunk as unknown as number[]);
        }

        return btoa(binaryString);
    }

    if (hasBuffer && content instanceof Buffer) {
        return content.toString("base64");
    }

    const uint8Array = content instanceof Uint8Array ? content : new Uint8Array(content as ArrayLike<number>);

    if (hasBuffer) {
        return Buffer.from(uint8Array).toString("base64");
    }

    // Convert in chunks to avoid stack overflow for large inputs
    let binaryString = "";
    const chunkSize = 8192;

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));

        // eslint-disable-next-line unicorn/prefer-code-point -- fromCharCode is correct for binary data
        binaryString += String.fromCharCode.apply(undefined, chunk as unknown as number[]);
    }

    return btoa(binaryString);
};

export default toBase64;
