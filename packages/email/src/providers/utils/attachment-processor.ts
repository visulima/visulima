import { Buffer } from "node:buffer";

import { EmailError } from "../../errors/email-error";
import type { Attachment } from "../../types";

/**
 * Process attachment content and convert to base64 string
 */
export async function processAttachmentContent(attachment: Attachment, providerName: string): Promise<string> {
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
}

/**
 * Create a standardized attachment object for API payloads
 */
export async function createStandardAttachment(
    attachment: Attachment,
    providerName: string,
): Promise<{
    content: string;
    contentId?: string;
    contentType: string;
    disposition: string;
    filename: string;
}> {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        content,
        contentType: attachment.contentType || "application/octet-stream",
        disposition: attachment.contentDisposition || "attachment",
        filename: attachment.filename,
        ...attachment.cid && { contentId: attachment.cid },
    };
}

/**
 * Create SendGrid-specific attachment format
 */
export async function createSendGridAttachment(
    attachment: Attachment,
    providerName: string,
): Promise<{
    content: string;
    content_id?: string;
    disposition: string;
    filename: string;
    type: string;
}> {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        content,
        disposition: attachment.contentDisposition || "attachment",
        filename: attachment.filename,
        type: attachment.contentType || "application/octet-stream",
        ...attachment.cid && { content_id: attachment.cid },
    };
}

/**
 * Create Postmark-specific attachment format
 */
export async function createPostmarkAttachment(
    attachment: Attachment,
    providerName: string,
): Promise<{
    Content: string;
    ContentID?: string;
    ContentType: string;
    Name: string;
}> {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        Content: content,
        ContentType: attachment.contentType || "application/octet-stream",
        Name: attachment.filename,
        ...attachment.cid && { ContentID: attachment.cid },
    };
}

/**
 * Create Mailgun-specific attachment format (form data)
 */
export async function createMailgunAttachment(
    attachment: Attachment,
    providerName: string,
    index: number,
): Promise<{
    content: string;
    key: string;
}> {
    const content = await processAttachmentContent(attachment, providerName);

    return {
        content,
        key: `attachment[${index}]`,
    };
}
