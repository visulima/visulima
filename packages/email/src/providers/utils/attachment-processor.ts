import { Buffer } from "node:buffer";

import EmailError from "../../errors/email-error";
import type { Attachment } from "../../types";

/**
 * Processes attachment content and converts it to a base64-encoded string.
 * @param attachment The attachment object to process.
 * @param providerName The name of the provider (for error messages).
 * @returns The base64-encoded string representation of the attachment content.
 * @throws {EmailError} When the attachment has no content.
 */
export const processAttachmentContent = async (attachment: Attachment, providerName: string): Promise<string> => {
    let content: string;

    if (attachment.content) {
        if (typeof attachment.content === "string") {
            content = attachment.content;
        } else if (attachment.content instanceof Promise) {
            const buffer = await attachment.content;

            content = Buffer.from(buffer).toString("base64");
        } else {
            content = attachment.content.toString("base64");
        }
    } else if (attachment.raw) {
        content = typeof attachment.raw === "string" ? attachment.raw : attachment.raw.toString("base64");
    } else {
        throw new EmailError(providerName, `Attachment ${attachment.filename} has no content`);
    }

    return content;
};

/**
 * Creates a standardized attachment object for API payloads.
 * @param attachment The attachment object to standardize.
 * @param providerName The name of the provider (for error messages).
 * @returns A standardized attachment object with content, contentType, disposition, filename, and optional contentId.
 */
export const createStandardAttachment = async (
    attachment: Attachment,
    providerName: string,
): Promise<{
    content: string;
    contentId?: string;
    contentType: string;
    disposition: string;
    filename: string;
}> => {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        content,
        contentType: attachment.contentType || "application/octet-stream",
        disposition: attachment.contentDisposition || "attachment",
        filename: attachment.filename,
        ...(attachment.cid && { contentId: attachment.cid }),
    };
};

/**
 * Creates a SendGrid-specific attachment format.
 * @param attachment The attachment object to format.
 * @param providerName The name of the provider (for error messages).
 * @returns A SendGrid-formatted attachment object with content, type, disposition, filename, and optional content_id.
 */
export const createSendGridAttachment = async (
    attachment: Attachment,
    providerName: string,
): Promise<{
    content: string;
    content_id?: string;
    disposition: string;
    filename: string;
    type: string;
}> => {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        content,
        disposition: attachment.contentDisposition || "attachment",
        filename: attachment.filename,
        type: attachment.contentType || "application/octet-stream",
        ...(attachment.cid && { content_id: attachment.cid }),
    };
};

/**
 * Creates a Postmark-specific attachment format.
 * @param attachment The attachment object to format.
 * @param providerName The name of the provider (for error messages).
 * @returns A Postmark-formatted attachment object with Content, ContentType, Name, and optional ContentID.
 */
export const createPostmarkAttachment = async (
    attachment: Attachment,
    providerName: string,
): Promise<{
    Content: string;
    ContentID?: string;
    ContentType: string;
    Name: string;
}> => {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        Content: content,
        ContentType: attachment.contentType || "application/octet-stream",
        Name: attachment.filename,
        ...(attachment.cid && { ContentID: attachment.cid }),
    };
};

/**
 * Creates a Mailgun-specific attachment format for form data.
 * @param attachment The attachment object to format.
 * @param providerName The name of the provider (for error messages).
 * @param index The index of the attachment in the attachments array.
 * @returns A Mailgun-formatted attachment object with content and key properties.
 */
export const createMailgunAttachment = async (
    attachment: Attachment,
    providerName: string,
    index: number,
): Promise<{
    content: string;
    key: string;
}> => {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        content,
        key: `attachment[${index}]`,
    };
};
