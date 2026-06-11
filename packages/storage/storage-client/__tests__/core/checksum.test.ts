import { describe, expect, it } from "vitest";

import { computeChunkChecksum } from "../../src/core/checksum";

describe(computeChunkChecksum, () => {
    it("should compute a stable SHA-256 hex digest", async () => {
        expect.assertions(2);

        const chunk = new Blob(["hello world"]);
        const digest = await computeChunkChecksum(chunk);

        // SHA-256 of "hello world".
        expect(digest).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
        expect(digest).toHaveLength(64);
    });

    it("should support an explicit algorithm", async () => {
        expect.assertions(1);

        const chunk = new Blob(["hello world"]);
        const digest = await computeChunkChecksum(chunk, "SHA-1");

        // SHA-1 of "hello world".
        expect(digest).toBe("2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
    });

    it("should produce different digests for different content", async () => {
        expect.assertions(1);

        const a = await computeChunkChecksum(new Blob(["a"]));
        const b = await computeChunkChecksum(new Blob(["b"]));

        expect(a).not.toBe(b);
    });
});
