import { readFile } from "@visulima/fs";
import { describe, expect, it, vi } from "vitest";

import type { AttachmentDataOptions, AttachmentOptions } from "../src/attachment-helpers";
import { detectMimeType, generateContentId, readFileAsBuffer } from "../src/attachment-helpers";

vi.mock(import("@visulima/fs"), () => {
    return {
        readFile: vi.fn<Parameters<typeof import("@visulima/fs").readFile>>(),
    };
});

describe("attachment-helpers", () => {
    describe(detectMimeType, () => {
        it("should detect MIME type for common file extensions", () => {
            expect.assertions(4);
            expect(detectMimeType("document.pdf")).toBe("application/pdf");
            expect(detectMimeType("image.png")).toBe("image/png");
            expect(detectMimeType("text.txt")).toBe("text/plain");
            expect(detectMimeType("script.js")).toBe("text/javascript");
        });

        it("should fallback to application/octet-stream for unknown extensions", () => {
            expect.assertions(3);
            expect(detectMimeType("file.unknown")).toBe("application/octet-stream");
            expect(detectMimeType("noextension")).toBe("application/octet-stream");
            expect(detectMimeType("")).toBe("application/octet-stream");
        });

        it("should handle files with multiple extensions", () => {
            expect.assertions(2);
            expect(detectMimeType("archive.tar.gz")).toBe("application/gzip");
            expect(detectMimeType("document.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        });
    });

    describe(generateContentId, () => {
        it("should generate a valid Content-ID format", () => {
            expect.assertions(1);

            const cid = generateContentId("test-image.png");

            expect(cid).toMatch(/^test-image-png-[a-z0-9]{7}@email$/);
        });

        it("should sanitize filenames with special characters", () => {
            expect.assertions(1);

            const cid = generateContentId("test image (1).png");

            expect(cid).toMatch(/^test-image-1-png-[a-z0-9]{7}@email$/);
        });

        it("should convert to lowercase", () => {
            expect.assertions(1);

            const cid = generateContentId("TEST-IMAGE.PNG");

            expect(cid).toMatch(/^test-image-png-[a-z0-9]{7}@email$/);
        });

        it("should generate unique IDs for the same filename", () => {
            expect.assertions(3);

            const cid1 = generateContentId("test.png");
            const cid2 = generateContentId("test.png");

            expect(cid1).not.toBe(cid2);
            expect(cid1).toMatch(/^test-png-[a-z0-9]{7}@email$/);
            expect(cid2).toMatch(/^test-png-[a-z0-9]{7}@email$/);
        });
    });

    describe(readFileAsBuffer, () => {
        it("should read file content as Buffer", async () => {
            expect.assertions(2);

            const mockBuffer = Buffer.from("test content");

            vi.mocked(readFile).mockResolvedValue(mockBuffer);

            const result = await readFileAsBuffer("/path/to/file.txt");

            expect(readFile).toHaveBeenCalledWith("/path/to/file.txt", { buffer: true });
            expect(result).toBe(mockBuffer);
        });

        it("should propagate errors from readFile", async () => {
            expect.assertions(1);

            const error = new Error("File not found");

            vi.mocked(readFile).mockRejectedValue(error);

            await expect(readFileAsBuffer("/nonexistent/file.txt")).rejects.toThrow("File not found");
        });
    });

    describe("attachmentOptions interface", () => {
        it("should allow all optional properties", () => {
            expect.assertions(6);

            const options: AttachmentOptions = {
                cid: "test@example.com",
                contentDisposition: "inline",
                contentType: "image/png",
                encoding: "base64",
                filename: "test.png",
                headers: { "X-Custom": "value" },
            };

            expect(options.cid).toBe("test@example.com");
            expect(options.contentDisposition).toBe("inline");
            expect(options.contentType).toBe("image/png");
            expect(options.encoding).toBe("base64");
            expect(options.filename).toBe("test.png");
            expect(options.headers).toStrictEqual({ "X-Custom": "value" });
        });

        it("should allow minimal options", () => {
            expect.assertions(1);

            const options: AttachmentOptions = {};

            expect(options).toStrictEqual({});
        });
    });

    describe("attachmentDataOptions interface", () => {
        it("should require filename", () => {
            expect.assertions(1);

            const options: AttachmentDataOptions = {
                filename: "required.txt",
            };

            expect(options.filename).toBe("required.txt");
        });

        it("should allow all AttachmentOptions properties", () => {
            expect.assertions(6);

            const options: AttachmentDataOptions = {
                cid: "test@example.com",
                contentDisposition: "attachment",
                contentType: "text/plain",
                encoding: "7bit",
                filename: "test.txt",
                headers: { "X-Test": "value" },
            };

            expect(options.filename).toBe("test.txt");
            expect(options.cid).toBe("test@example.com");
            expect(options.contentDisposition).toBe("attachment");
            expect(options.contentType).toBe("text/plain");
            expect(options.encoding).toBe("7bit");
            expect(options.headers).toStrictEqual({ "X-Test": "value" });
        });
    });
});
