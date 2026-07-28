import EmailError from "../errors/email-error";
import type { EmailOptions } from "../types";
import { encodeMimeHeaderValue } from "./encode-mime-header";
import formatEmailAddress from "./format-email-address";
import formatEmailAddresses from "./format-email-addresses";
import generateBoundary from "./generate-boundary";
import headersToRecord from "./headers-to-record";
import encodeQuotedPrintable from "./quoted-printable";
import { sanitizeHeaderName, sanitizeHeaderValue } from "./sanitize-header";
import toBase64 from "./to-base64";

/**
 * Options that control how the MIME message is assembled for different
 * downstream consumers.
 */
interface BuildMimeMessageOptions {
    /**
     * Whether to include the `Bcc:` header in the generated message.
     *
     * Defaults to `false`. Transports (SMTP, Cloudflare raw-MIME) must NOT emit
     * the `Bcc:` header because the delivered message is what every To/Cc
     * recipient receives — including it would disclose the blind-copy list. Bcc
     * recipients are still delivered to via the envelope (`RCPT TO`). Only
     * `Mail.draft()` (EML output a human inspects) sets this to `true`.
     */
    includeBcc?: boolean;
}

// Matches any character outside printable ASCII (space through tilde) plus the
// permitted whitespace controls; such bodies must be quoted-printable encoded.
// eslint-disable-next-line regexp/no-obscure-range
const NON_ASCII_REGEX = /[^ -~\r\n\t]/;

/**
 * Sanitizes (strips CR/LF) and, when needed, RFC 2047 encodes a header value so
 * non-ASCII subjects/filenames produce a standards-compliant message instead of
 * raw UTF-8 octets in the header.
 * @param value The raw header value.
 * @returns The CRLF-safe, optionally encoded-word value.
 */
const encodeHeader = (value: string): string => encodeMimeHeaderValue(sanitizeHeaderValue(value));

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison
const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Wraps a continuous base64 string at 76 characters per line.
 *
 * RFC 2045 mandates base64 be wrapped at 76 chars and RFC 5321 forbids lines longer than 998
 * octets, so an unwrapped multi-KB line is rejected by strict MX/SMTP servers. `.{1,76}` ensures
 * the final short chunk is also emitted; `trimEnd` drops the trailing CRLF because the caller pushes
 * a blank line right after.
 * @param b64 The base64 string to wrap.
 * @returns The base64 string wrapped at 76 characters per line.
 */
const wrapBase64 = (b64: string): string => b64.replaceAll(/.{1,76}/g, "$&\r\n").trimEnd();

/**
 * Builds a MIME-formatted email message from email options.
 * @param options The email options to build the MIME message from.
 * @returns The MIME-formatted email message as a string.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, sonarjs/cognitive-complexity
const buildMimeMessage = async <T extends EmailOptions>(options: T, buildOptions: BuildMimeMessageOptions = {}): Promise<string> => {
    const { includeBcc = false } = buildOptions;
    const boundary = generateBoundary();
    const message: string[] = [`From: ${formatEmailAddress(options.from)}`, `To: ${formatEmailAddresses(options.to)}`];

    if (options.cc) {
        message.push(`Cc: ${formatEmailAddresses(options.cc)}`);
    }

    // Only emit Bcc for non-transport (draft/EML) output. Transports deliver to
    // Bcc recipients via the SMTP envelope, so writing the header into the body
    // would leak the blind-copy list to every To/Cc recipient.
    if (includeBcc && options.bcc) {
        message.push(`Bcc: ${formatEmailAddresses(options.bcc)}`);
    }

    if (options.replyTo) {
        message.push(`Reply-To: ${formatEmailAddress(options.replyTo)}`);
    }

    message.push(`Subject: ${encodeHeader(options.subject)}`, "MIME-Version: 1.0");

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

    // Renders a single body leaf (text or html) as MIME part lines. Non-ASCII
    // bodies must not be labelled 7bit; encode them quoted-printable.
    const renderBodyLeaf = (contentType: string, body: string): string[] => {
        if (NON_ASCII_REGEX.test(body)) {
            return [`Content-Type: ${contentType}; charset=UTF-8`, "Content-Transfer-Encoding: quoted-printable", "", encodeQuotedPrintable(body), ""];
        }

        return [`Content-Type: ${contentType}; charset=UTF-8`, "Content-Transfer-Encoding: 7bit", "", body, ""];
    };

    if (options.text && options.html) {
        // RFC 2046: plain-text and HTML are alternative renditions of the same
        // content and must be wrapped in multipart/alternative (least-faithful
        // first) so clients render exactly one representation instead of both.
        const alternativeBoundary = generateBoundary();

        message.push(
            `--${boundary}`,
            `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
            "",
            `--${alternativeBoundary}`,
            ...renderBodyLeaf("text/plain", options.text),
            `--${alternativeBoundary}`,
            ...renderBodyLeaf("text/html", options.html),
            `--${alternativeBoundary}--`,
            "",
        );
    } else if (options.text) {
        message.push(`--${boundary}`, ...renderBodyLeaf("text/plain", options.text));
    } else if (options.html) {
        message.push(`--${boundary}`, ...renderBodyLeaf("text/html", options.html));
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

            // Every attachment metadata field can flow from user uploads; strip
            // CR/LF (and RFC 2047 encode the filename) so a crafted value cannot
            // inject arbitrary headers or MIME parts.
            const contentType = sanitizeHeaderValue(attachment.contentType ?? "application/octet-stream");
            const sanitizedFilename = encodeHeader(attachment.filename);

            message.push(`Content-Type: ${contentType}; name="${sanitizedFilename}"`);

            const disposition = sanitizeHeaderValue(attachment.contentDisposition ?? "attachment");

            message.push(`Content-Disposition: ${disposition}; filename="${sanitizedFilename}"`);

            if (attachment.cid) {
                message.push(`Content-ID: <${sanitizeHeaderValue(attachment.cid)}>`);
            }

            if (attachment.headers) {
                Object.entries(attachment.headers).forEach(([key, value]) => {
                    const sanitizedName = sanitizeHeaderName(key);
                    const sanitizedValue = sanitizeHeaderValue(value);

                    message.push(`${sanitizedName}: ${sanitizedValue}`);
                });
            }

            const encoding = sanitizeHeaderValue(attachment.encoding ?? "base64");

            message.push(`Content-Transfer-Encoding: ${encoding}`, "");

            const attachmentContent = attachment.resolvedContent;

            if (encoding === "base64") {
                message.push(wrapBase64(toBase64(attachmentContent)));
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
                message.push(wrapBase64(toBase64(attachmentContent)));
            }

            message.push("");
        }
    }

    message.push(`--${boundary}--`);

    return message.join("\r\n");
};

export default buildMimeMessage;
export type { BuildMimeMessageOptions };
