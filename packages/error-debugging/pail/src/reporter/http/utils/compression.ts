/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable n/no-unsupported-features/node-builtins */

import { gzipSync } from "node:zlib";

/**
 * Compresses data using gzip compression.
 * @param data The data to compress as a string
 * @returns A Promise that resolves to the compressed data as Uint8Array
 */
const compressData = async (data: string): Promise<Uint8Array> => {
    // Use CompressionStream API if available (browser/edge)
    // Check for CompressionStream in a way that doesn't trigger Node.js version warnings
    const CompressionStreamClass = (globalThis as any).CompressionStream;

    if (CompressionStreamClass) {
        const stream = new CompressionStreamClass("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const encoder = new TextEncoder();
        const chunks: Uint8Array[] = [];

        writer.write(encoder.encode(data));
        writer.close();

        // Read all chunks from the stream
        let done = false;

        while (!done) {
            // eslint-disable-next-line no-await-in-loop
            const result = await reader.read();

            done = result.done ?? false;

            if (result.value) {
                chunks.push(result.value);
            }
        }

        // Combine all chunks
        const totalLength = chunks.reduce((accumulator, chunk) => accumulator + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }

    // Node.js environment - use zlib
    return gzipSync(data);
};

export default compressData;
