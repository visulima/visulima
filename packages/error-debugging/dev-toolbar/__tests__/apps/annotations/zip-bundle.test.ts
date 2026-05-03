import { describe, expect, it } from "vitest";

import type { ExportSessionFile } from "../../../src/apps/annotations/zip-bundle";
import { buildSessionZip } from "../../../src/apps/annotations/zip-bundle";

const view = (blob: Blob): Promise<DataView> =>
    blob.arrayBuffer().then((buf) => new DataView(buf));

describe(buildSessionZip, () => {
    it("emits a valid ZIP local file header signature", async () => {
        expect.assertions(2);

        const files: ExportSessionFile[] = [
            { content: "hello", encoding: "text", mimeType: "text/plain", path: "a.txt" },
        ];
        const blob = buildSessionZip(files);
        const v = await view(blob);

        // Local file header signature: PK\x03\x04 (little-endian 0x04034b50)
        expect(v.getUint32(0, true)).toBe(0x04_03_4b_50);
        expect(blob.type).toBe("application/zip");
    });

    it("ends with the EOCD signature and the right entry count", async () => {
        expect.assertions(3);

        const files: ExportSessionFile[] = [
            { content: "one", encoding: "text", mimeType: "text/plain", path: "1.txt" },
            { content: "two", encoding: "text", mimeType: "text/plain", path: "2.txt" },
            { content: "three", encoding: "text", mimeType: "text/plain", path: "3.txt" },
        ];
        const blob = buildSessionZip(files);
        const v = await view(blob);

        // EOCD is 22 bytes at the end.
        const eocdOffset = blob.size - 22;

        // EOCD signature: PK\x05\x06
        expect(v.getUint32(eocdOffset, true)).toBe(0x06_05_4b_50);
        // Total entries on disk + total entries in central directory = both equal 3.
        expect(v.getUint16(eocdOffset + 8, true)).toBe(3);
        expect(v.getUint16(eocdOffset + 10, true)).toBe(3);
    });

    it("handles base64-encoded binary attachments", async () => {
        expect.assertions(2);

        // 4 bytes of arbitrary data as base64
        const payload = "AAECAw=="; // [0x00, 0x01, 0x02, 0x03]
        const files: ExportSessionFile[] = [
            { content: payload, encoding: "base64", mimeType: "image/png", path: "screenshots/x.png" },
        ];
        const blob = buildSessionZip(files);
        const v = await view(blob);

        // Local header records compressed size = uncompressed size = 4
        expect(v.getUint32(18, true)).toBe(4);
        expect(v.getUint32(22, true)).toBe(4);
    });

    it("computes a CRC-32 that varies with content", async () => {
        expect.assertions(1);

        const a = await view(buildSessionZip([{ content: "hello", encoding: "text", mimeType: "t/p", path: "a" }]));
        const b = await view(buildSessionZip([{ content: "world", encoding: "text", mimeType: "t/p", path: "a" }]));

        // CRC-32 lives at offset 14 in the local header.
        expect(a.getUint32(14, true)).not.toBe(b.getUint32(14, true));
    });

    it("produces an empty central directory when given no files", async () => {
        expect.assertions(3);

        const blob = buildSessionZip([]);
        const v = await view(blob);

        // Should be just an EOCD record (22 bytes), no entries.
        expect(blob.size).toBe(22);
        expect(v.getUint32(0, true)).toBe(0x06_05_4b_50);
        expect(v.getUint16(8, true)).toBe(0);
    });
});
