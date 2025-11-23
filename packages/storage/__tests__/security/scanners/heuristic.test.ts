import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { HeuristicScanner } from "../../../src/security/scanners/heuristic";
import type { File } from "../../../src/utils/file";

const createFile = (overrides: Partial<File> = {}): File =>
    ({
        contentType: "application/octet-stream",
        id: "test-file",
        name: "test-file.txt",
        size: 100,
        ...overrides,
    }) as File;

describe("HeuristicScanner", () => {
    it("should detect dangerous extensions", async () => {
        const scanner = new HeuristicScanner();
        const file = createFile({ name: "malware.exe" });

        const result = await scanner.scan(file, Buffer.from("content"));

        expect(result.detected).toBe(true);
        expect(result.reason).toContain("Dangerous file extension detected: .exe");
    });

    it("should detect double extensions", async () => {
        const scanner = new HeuristicScanner({ checkDoubleExtension: true });
        const file = createFile({ name: "invoice.pdf.exe" });

        const result = await scanner.scan(file, Buffer.from("content"));

        expect(result.detected).toBe(true);
        expect(result.reason).toContain("Double file extension detected");
    });

    it("should not flag safe double extensions", async () => {
        const scanner = new HeuristicScanner({ checkDoubleExtension: true });
        const file = createFile({ name: "archive.tar.gz" });

        const result = await scanner.scan(file, Buffer.from("content"));

        expect(result.detected).toBe(false);
    });

    it("should detect MIME type mismatch", async () => {
        const scanner = new HeuristicScanner({ checkMimeMismatch: true });
        // Declare as PNG but content is executable (or just text)
        const file = createFile({ contentType: "image/png", name: "image.png" });
        const content = Buffer.from("not a png image");

        const result = await scanner.scan(file, content);

        // note: file-type might not detect "not a png image" as anything specific, returning undefined.
        // If undefined, we skip mismatch check in current implementation.
        // Let's use a valid signature for something else.
        // GIF signature: GIF89a
        const gifContent = Buffer.from("GIF89a");
        const result2 = await scanner.scan(file, gifContent);

        expect(result2.detected).toBe(true);
        expect(result2.reason).toContain('MIME type mismatch: declared "image/png" but detected "image/gif"');
    });

    it("should pass when MIME type matches", async () => {
        const scanner = new HeuristicScanner({ checkMimeMismatch: true });
        const file = createFile({ contentType: "image/gif", name: "image.gif" });
        const content = Buffer.from("GIF89a");

        const result = await scanner.scan(file, content);

        expect(result.detected).toBe(false);
    });

    it("should skip MIME check for streams (for now)", async () => {
        const scanner = new HeuristicScanner({ checkMimeMismatch: true });
        const file = createFile({ contentType: "image/png", name: "image.png" });
        const content = Readable.from("GIF89a");

        const result = await scanner.scan(file, content);

        expect(result.detected).toBe(false);
    });
});
