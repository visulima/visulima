/**
 * Writes `data` to `stream`, preferring the original `write` implementation that
 * `PailServer.wrapStd()` stashes on `__write` so wrapped streams do not recurse.
 *
 * Runtimes without Node's standard streams (workerd and other edge runtimes where
 * `node:process` exposes no `stdout`/`stderr`) hand reporters an `undefined` stream.
 * Writing is skipped there instead of throwing, mirroring how `wrapStd()` already
 * treats a missing stream as a no-op.
 * @param data The already-formatted payload to write.
 * @param stream The destination stream, or `undefined` when the runtime has none.
 * @returns `true` when the payload was handed to the stream, `false` when it was dropped.
 */
const writeStream = (data: string, stream: NodeJS.WriteStream | undefined): boolean => {
    if (!stream) {
        return false;
    }

    const write: NodeJS.WriteStream["write"]
        = ((stream as unknown as Record<string, unknown>)["__write"] as NodeJS.WriteStream["write"] | undefined) ?? stream.write.bind(stream);

    return write.call(stream, data);
};

export default writeStream;
