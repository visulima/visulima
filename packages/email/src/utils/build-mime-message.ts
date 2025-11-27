import EmailError from "../errors/email-error";
import type { EmailOptions } from "../types";
import formatEmailAddress from "./format-email-address";
import formatEmailAddresses from "./format-email-addresses";
import generateBoundary from "./generate-boundary";
import headersToRecord from "./headers-to-record";
import { sanitizeHeaderName, sanitizeHeaderValue } from "./sanitize-header";
import toBase64 from "./to-base64";

const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Builds a MIME-formatted email message from email options.
 * @param options The email options to build the MIME message from.
 * @returns The MIME-formatted email message as a string.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const buildMimeMessage = async <T extends EmailOptions>(options: T): Promise<string> => {
    const boundary = generateBoundary();
    const message: string[] = [`From: ${formatEmailAddress(options.from)}`, `To: ${formatEmailAddresses(options.to)}`];

    if (options.cc) {
        message.push(`Cc: ${formatEmailAddresses(options.cc)}`);
    }

    if (options.bcc) {
        message.push(`Bcc: ${formatEmailAddresses(options.bcc)}`);
    }

    if (options.replyTo) {
        message.push(`Reply-To: ${formatEmailAddress(options.replyTo)}`);
    }

    message.push(`Subject: ${sanitizeHeaderValue(options.subject)}`, "MIME-Version: 1.0");

    if (options.headers) {
        // Convert ImmutableHeaders to Record<string, string> if needed
        const headersRecord = headersToRecord(options.headers);

        Object.entries(headersRecord).forEach(([key, value]) => {
            const sanitizedName = sanitizeHeaderName(key);
            const sanitizedValue = sanitizeHeaderValue(value);

            message.push(`${sanitizedName}: ${sanitizedValue}`);
        });
    }

    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, "");

    if (options.text) {
        message.push(`--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 7bit", "", options.text, "");
    }

    if (options.html) {
        message.push(`--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: 7bit", "", options.html, "");
    }

    if (options.attachments && options.attachments.length > 0) {
        // Resolve all async attachments first to avoid await in loop
        const resolvedAttachments = await Promise.all(
            options.attachments.map(async (attachment) => {
                let attachmentContent: string | Buffer | Uint8Array | undefined;

                if (attachment.raw !== undefined) {
                    attachmentContent = attachment.raw;
                } else if (attachment.content === undefined) {
                    throw new EmailError(
                        "attachment",
                        `Attachment '${attachment.filename}' must have content, raw, or be resolved from path/href before building MIME message`,
                    );
                } else {
                    // Handle async content (Promise<Uint8Array>)
                    attachmentContent = attachment.content instanceof Promise ? await attachment.content : attachment.content;
                }

                return { ...attachment, resolvedContent: attachmentContent };
            }),
        );

        for (const attachment of resolvedAttachments) {
            message.push(`--${boundary}`);

            const contentType = attachment.contentType || "application/octet-stream";
            const sanitizedFilename = sanitizeHeaderValue(attachment.filename);

            message.push(`Content-Type: ${contentType}; name="${sanitizedFilename}"`);

            const disposition = attachment.contentDisposition || "attachment";

            message.push(`Content-Disposition: ${disposition}; filename="${sanitizedFilename}"`);

            if (attachment.cid) {
                message.push(`Content-ID: <${attachment.cid}>`);
            }

            if (attachment.headers) {
                Object.entries(attachment.headers).forEach(([key, value]) => {
                    const sanitizedName = sanitizeHeaderName(key);
                    const sanitizedValue = sanitizeHeaderValue(value);

                    message.push(`${sanitizedName}: ${sanitizedValue}`);
                });
            }

            const encoding = attachment.encoding || "base64";

            message.push(`Content-Transfer-Encoding: ${encoding}`, "");

            const attachmentContent = attachment.resolvedContent;

            if (encoding === "base64") {
                message.push(toBase64(attachmentContent));
            } else if (encoding === "7bit" || encoding === "8bit") {
                if (typeof attachmentContent === "string") {
                    message.push(attachmentContent);
                } else if (hasBuffer && attachmentContent instanceof Buffer) {
                    message.push(attachmentContent.toString("utf8"));
                } else {
                    // Uint8Array
                    const decoder = new TextDecoder();

                    message.push(decoder.decode(attachmentContent));
                }
            } else {
                message.push(toBase64(attachmentContent));
            }

            message.push("");
        }
    }

    message.push(`--${boundary}--`);

    return message.join("\r\n");
};

export default buildMimeMessage;
