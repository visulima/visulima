import { EmailError } from "../errors/email-error";
import type { EmailOptions } from "../types";
import { formatEmailAddress } from "./format-email-address";
import { formatEmailAddresses } from "./format-email-addresses";
import { generateBoundary } from "./generate-boundary";
import { headersToRecord } from "./headers-to-record";
import { toBase64 } from "./to-base64";

const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Build a MIME message from email options
 */
export const buildMimeMessage = async <T extends EmailOptions>(options: T): Promise<string> => {
    const boundary = generateBoundary();
    const message: string[] = [];

    message.push(`From: ${formatEmailAddress(options.from)}`);
    message.push(`To: ${formatEmailAddresses(options.to)}`);

    if (options.cc) {
        message.push(`Cc: ${formatEmailAddresses(options.cc)}`);
    }

    if (options.bcc) {
        message.push(`Bcc: ${formatEmailAddresses(options.bcc)}`);
    }

    if (options.replyTo) {
        message.push(`Reply-To: ${formatEmailAddress(options.replyTo)}`);
    }

    message.push(`Subject: ${options.subject}`, "MIME-Version: 1.0");

    if (options.headers) {
        // Convert ImmutableHeaders to Record<string, string> if needed
        const headersRecord = headersToRecord(options.headers);

        Object.entries(headersRecord).forEach(([key, value]) => {
            message.push(`${key}: ${value}`);
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
        for (const attachment of options.attachments) {
            message.push(`--${boundary}`);

            const contentType = attachment.contentType || "application/octet-stream";

            message.push(`Content-Type: ${contentType}; name="${attachment.filename}"`);

            const disposition = attachment.contentDisposition || "attachment";

            message.push(`Content-Disposition: ${disposition}; filename="${attachment.filename}"`);

            if (attachment.cid) {
                message.push(`Content-ID: <${attachment.cid}>`);
            }

            if (attachment.headers) {
                Object.entries(attachment.headers).forEach(([key, value]) => {
                    message.push(`${key}: ${value}`);
                });
            }

            const encoding = attachment.encoding || "base64";

            message.push(`Content-Transfer-Encoding: ${encoding}`, "");

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

            if (encoding === "base64") {
                message.push(toBase64(attachmentContent));
            } else if (encoding === "7bit" || encoding === "8bit") {
                if (typeof attachmentContent === "string") {
                    message.push(attachmentContent);
                } else if (hasBuffer && attachmentContent instanceof Buffer) {
                    message.push(attachmentContent.toString("utf-8"));
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
