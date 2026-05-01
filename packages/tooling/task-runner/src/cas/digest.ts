import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import type { CasDigest } from "../backends/types";

/**
 * Compute the sha256 digest of a buffer's bytes. Lowercase hex, matching
 * REAPI's `Digest.hash` format. Used for synchronous payloads (small
 * AC metadata, action proto bytes) where streaming isn't worth it.
 */
export const digestBuffer = (bytes: Buffer): CasDigest => {
    const hash = createHash("sha256").update(bytes).digest("hex");

    return { hash, sizeBytes: bytes.byteLength };
};

/**
 * Compute the sha256 digest of a file's contents by streaming. Avoids
 * loading multi-hundred-MB outputs into memory. Returns `undefined`
 * when the file can't be opened (caller decides whether that's fatal).
 */
export const digestFile = async (filePath: string): Promise<CasDigest | undefined> => {
    try {
        const { size } = await stat(filePath);
        const hasher = createHash("sha256");
        const source = createReadStream(filePath);

        for await (const chunk of source) {
            hasher.update(chunk as Buffer);
        }

        return { hash: hasher.digest("hex"), sizeBytes: size };
    } catch {
        return undefined;
    }
};
