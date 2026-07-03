/**
 * Drains an async iterable of byte chunks into a single Buffer.
 *
 * Note: this buffers the whole stream in memory — callers (FTP/SFTP adapters)
 * accept this because the underlying clients have no append/streaming-resume
 * primitive and an ETag must be computed over the full payload.
 */
const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

export default collectStream;
