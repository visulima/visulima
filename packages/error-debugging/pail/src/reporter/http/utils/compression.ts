/* eslint-disable n/no-unsupported-features/node-builtins */

interface CompressionStreamLike {
    readable: { getReader: () => ReadableStreamDefaultReader<Uint8Array> };
    writable: { getWriter: () => WritableStreamDefaultWriter<Uint8Array> };
}

/**
 * Loads `gzipSync` from `node:zlib` on demand.
 *
 * The import is deliberately dynamic: edge runtimes (Cloudflare Workers without
 * `nodejs_compat`, Vercel Edge) do not provide `node:zlib`, and a static import
 * would make merely *loading* the HTTP reporter fail there — even though those
 * runtimes never reach this branch because they ship `CompressionStream`.
 * @returns The `gzipSync` implementation, or `undefined` when `node:zlib` is unavailable.
 */
const loadNodeGzip = async (): Promise<((input: string) => Uint8Array) | undefined> => {
    try {
        const { gzipSync } = (await import("node:zlib")) as { gzipSync?: (input: string) => Uint8Array };

        return typeof gzipSync === "function" ? gzipSync : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Compresses data using gzip compression.
 *
 * Prefers the Web-standard `CompressionStream` (browsers, Cloudflare Workers, Deno,
 * modern Node) and falls back to `node:zlib` only when it is absent.
 * @param data The data to compress as a string
 * @returns A Promise that resolves to the compressed data as Uint8Array
 * @throws {Error} When the runtime provides neither `CompressionStream` nor `node:zlib`.
 */
const compressData = async (data: string): Promise<Uint8Array> => {
    // Use CompressionStream API if available (browser/edge)
    // Check for CompressionStream in a way that doesn't trigger Node.js version warnings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CompressionStreamClass = (globalThis as Record<string, any>).CompressionStream as (new (format: string) => CompressionStreamLike) | undefined;

    if (CompressionStreamClass) {
        const stream = new CompressionStreamClass("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const encoder = new TextEncoder();
        const chunks: Uint8Array[] = [];

        await writer.write(encoder.encode(data));
        await writer.close();

        // Read all chunks from the stream
        let done = false;

        while (!done) {
            // eslint-disable-next-line no-await-in-loop
            const result = await reader.read();

            done = result.done;

            if (result.value) {
                chunks.push(result.value);
            }
        }

        // Combine all chunks
        const totalLength = chunks.reduce((accumulator, chunk) => accumulator + chunk.length, 0);
        const resultBuffer = new Uint8Array(totalLength);
        let offset = 0;

        for (let i = 0; i < chunks.length; i += 1) {
            const chunk = chunks[i];

            resultBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        return resultBuffer;
    }

    // Node.js environment - use zlib
    const gzipSync = await loadNodeGzip();

    if (gzipSync === undefined) {
        throw new Error("gzip compression is unavailable: this runtime provides neither CompressionStream nor node:zlib.");
    }

    return gzipSync(data);
};

export default compressData;
