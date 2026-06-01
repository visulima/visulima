import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import EmailError from "../../../src/errors/email-error";
import {
    createMailgunAttachment,
    createPostmarkAttachment,
    createSendGridAttachment,
    createStandardAttachment,
    processAttachmentContent,
} from "../../../src/providers/utils/attachment-processor";

describe(processAttachmentContent, () => {
    it("should return string content as-is", async () => {
        expect.assertions(1);

        const result = await processAttachmentContent({ content: "stringcontent", filename: "a.txt" }, "test");

        expect(result).toBe("stringcontent");
    });

    it("should convert Buffer content to base64", async () => {
        expect.assertions(1);

        const result = await processAttachmentContent({ content: Buffer.from("hi"), filename: "a.txt" }, "test");

        expect(result).toBe("aGk=");
    });

    it("should resolve Promise content to base64", async () => {
        expect.assertions(1);

        const result = await processAttachmentContent({ content: Promise.resolve(Buffer.from("hi")), filename: "a.txt" }, "test");

        expect(result).toBe("aGk=");
    });

    it("should use raw string when content is missing", async () => {
        expect.assertions(1);

        const result = await processAttachmentContent({ filename: "a.txt", raw: "rawstring" }, "test");

        expect(result).toBe("rawstring");
    });

    it("should use raw buffer when content is missing", async () => {
        expect.assertions(1);

        const result = await processAttachmentContent({ filename: "a.txt", raw: Buffer.from("hi") }, "test");

        expect(result).toBe("aGk=");
    });

    it("should throw EmailError when content and raw are missing", async () => {
        expect.assertions(1);

        await expect(processAttachmentContent({ filename: "x.txt" }, "test")).rejects.toThrow(EmailError);
    });
});

describe(createStandardAttachment, () => {
    it("should create standard attachment object", async () => {
        expect.assertions(1);

        const result = await createStandardAttachment({ cid: "cid-1", content: "abc", contentType: "text/plain", filename: "a.txt" }, "test");

        expect(result).toStrictEqual({
            content: "abc",
            contentId: "cid-1",
            contentType: "text/plain",
            disposition: "attachment",
            filename: "a.txt",
        });
    });

    it("should default contentType and disposition", async () => {
        expect.assertions(2);

        const result = await createStandardAttachment({ content: "abc", filename: "a.bin" }, "test");

        expect(result.contentType).toBe("application/octet-stream");
        expect(result.disposition).toBe("attachment");
    });
});

describe(createSendGridAttachment, () => {
    it("should create SendGrid-formatted attachment", async () => {
        expect.assertions(1);

        const result = await createSendGridAttachment({ cid: "cid-1", content: "abc", contentType: "text/plain", filename: "a.txt" }, "test");

        expect(result).toStrictEqual({
            content: "abc",
            content_id: "cid-1",
            disposition: "attachment",
            filename: "a.txt",
            type: "text/plain",
        });
    });

    it("should default the type when contentType is missing", async () => {
        expect.assertions(1);

        const result = await createSendGridAttachment({ content: "abc", filename: "a.bin" }, "test");

        expect(result.type).toBe("application/octet-stream");
    });
});

describe(createPostmarkAttachment, () => {
    it("should create Postmark-formatted attachment", async () => {
        expect.assertions(1);

        const result = await createPostmarkAttachment({ cid: "cid-1", content: "abc", contentType: "text/plain", filename: "a.txt" }, "test");

        expect(result).toStrictEqual({
            Content: "abc",
            ContentID: "cid-1",
            ContentType: "text/plain",
            Name: "a.txt",
        });
    });

    it("should default the ContentType when contentType is missing", async () => {
        expect.assertions(1);

        const result = await createPostmarkAttachment({ content: "abc", filename: "a.bin" }, "test");

        expect(result.ContentType).toBe("application/octet-stream");
    });
});

describe(createMailgunAttachment, () => {
    it("should create Mailgun-formatted attachment with correct key", async () => {
        expect.assertions(1);

        const result = await createMailgunAttachment({ content: "abc", filename: "a.txt" }, "test", 3);

        expect(result).toStrictEqual({
            content: "abc",
            key: "attachment[3]",
        });
    });
});
