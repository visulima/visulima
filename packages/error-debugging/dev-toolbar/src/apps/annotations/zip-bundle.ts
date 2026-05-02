/**
 * Minimal in-browser zip writer (store-only, no compression). Sufficient for
 * a session export: the bundle holds JSON + markdown text plus already-
 * compressed PNG/JPEG/WebP/GIF binaries, so deflate would buy almost nothing.
 *
 * Output format: ZIP 2.0, store method (0x0000), with central directory.
 * Compatible with macOS Archive Utility, Windows Explorer, `unzip`, etc.
 */

interface ZipEntry {
    /** Decoded raw bytes */
    bytes: Uint8Array;
    /** Filename with forward slashes */
    name: string;
}

const textEncoder = new TextEncoder();

const decodeBase64 = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
};

// Minimal CRC-32 — IEEE 802.3 polynomial.
const crcTable = (() => {
    const table = new Uint32Array(256);

    for (let n = 0; n < 256; n += 1) {
        let c = n;

        for (let k = 0; k < 8; k += 1) {
            c = (c & 1) === 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
        }

        table[n] = c >>> 0;
    }

    return table;
})();

const crc32 = (bytes: Uint8Array): number => {
    let c = 0xff_ff_ff_ff;

    for (let i = 0; i < bytes.length; i += 1) {
        c = (c >>> 8) ^ crcTable[(c ^ bytes[i]!) & 0xff]!;
    }

    return (c ^ 0xff_ff_ff_ff) >>> 0;
};

const dosTime = (date: Date): { date: number; time: number } => ({
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >>> 1),
});

export interface ExportSessionFile {
    content: string;
    encoding: "base64" | "text";
    mimeType: string;
    path: string;
}

/**
 * Build a zip blob from the flat file list returned by `exportSession`.
 */
export const buildSessionZip = (files: ExportSessionFile[]): Blob => {
    const entries: ZipEntry[] = files.map((file) => ({
        bytes: file.encoding === "text" ? textEncoder.encode(file.content) : decodeBase64(file.content),
        name: file.path,
    }));

    const localChunks: Uint8Array[] = [];
    const centralChunks: Uint8Array[] = [];
    const { date: modDate, time: modTime } = dosTime(new Date());
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = textEncoder.encode(entry.name);
        const crc = crc32(entry.bytes);
        const local = new Uint8Array(30 + nameBytes.length + entry.bytes.length);
        const view = new DataView(local.buffer);

        view.setUint32(0, 0x04_03_4b_50, true); // local file header signature
        view.setUint16(4, 20, true); // version needed
        view.setUint16(6, 0, true); // flags
        view.setUint16(8, 0, true); // method (store)
        view.setUint16(10, modTime, true);
        view.setUint16(12, modDate, true);
        view.setUint32(14, crc, true);
        view.setUint32(18, entry.bytes.length, true); // compressed
        view.setUint32(22, entry.bytes.length, true); // uncompressed
        view.setUint16(26, nameBytes.length, true);
        view.setUint16(28, 0, true); // extra
        local.set(nameBytes, 30);
        local.set(entry.bytes, 30 + nameBytes.length);
        localChunks.push(local);

        const central = new Uint8Array(46 + nameBytes.length);
        const cView = new DataView(central.buffer);

        cView.setUint32(0, 0x02_01_4b_50, true); // central dir signature
        cView.setUint16(4, 20, true); // version made by
        cView.setUint16(6, 20, true); // version needed
        cView.setUint16(8, 0, true);
        cView.setUint16(10, 0, true);
        cView.setUint16(12, modTime, true);
        cView.setUint16(14, modDate, true);
        cView.setUint32(16, crc, true);
        cView.setUint32(20, entry.bytes.length, true);
        cView.setUint32(24, entry.bytes.length, true);
        cView.setUint16(28, nameBytes.length, true);
        cView.setUint16(30, 0, true); // extra
        cView.setUint16(32, 0, true); // comment
        cView.setUint16(34, 0, true); // disk
        cView.setUint16(36, 0, true); // internal attrs
        cView.setUint32(38, 0, true); // external attrs
        cView.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        centralChunks.push(central);

        offset += local.length;
    }

    const centralSize = centralChunks.reduce((sum, c) => sum + c.length, 0);
    const eocd = new Uint8Array(22);
    const eView = new DataView(eocd.buffer);

    eView.setUint32(0, 0x06_05_4b_50, true);
    eView.setUint16(4, 0, true); // disk
    eView.setUint16(6, 0, true); // central dir disk
    eView.setUint16(8, entries.length, true);
    eView.setUint16(10, entries.length, true);
    eView.setUint32(12, centralSize, true);
    eView.setUint32(16, offset, true);
    eView.setUint16(20, 0, true);

    // TS 5+ refines Uint8Array<ArrayBufferLike> which Blob's BlobPart doesn't
    // accept directly. Cast through BlobPart[] — the runtime contract is met.
    return new Blob([...localChunks, ...centralChunks, eocd] as unknown as BlobPart[], { type: "application/zip" });
};

/**
 * Trigger a browser download of the zip blob.
 */
export const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
