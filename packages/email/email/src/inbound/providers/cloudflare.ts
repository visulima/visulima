import type { InboundEmail } from "../types";
import { lowercaseHeaders, nonEmpty, parseAddress, parseAddressList, parseReferences } from "../utils";

/**
 * The shape of a Cloudflare Email Workers message, narrowed to what the parser reads.
 *
 * Cloudflare delivers a `ForwardableEmailMessage` with `from`, `to`, and a `Headers` object; the body
 * arrives as a raw stream you must parse yourself, so pass the decoded `text`/`html` alongside it.
 */
interface CloudflareEmailLike {
    from?: string;
    headers?: Headers | Record<string, string>;
    html?: string;
    text?: string;
    to?: string;
}

/**
 * Parses a [Cloudflare Email Workers](https://developers.cloudflare.com/email-routing/email-workers/)
 * message into the normalized {@link InboundEmail} shape.
 *
 * Because Cloudflare exposes the body only as a raw stream, decode it first and pass the result via
 * `text`/`html`.
 * @param message The Cloudflare email message (plus optionally the decoded body).
 * @returns The normalized inbound email.
 */
const parseCloudflareInbound = (message: CloudflareEmailLike): InboundEmail => {
    const headers
        = message.headers instanceof Headers
            ? Object.fromEntries([...message.headers].map(([key, value]) => [key.toLowerCase(), value]))
            : lowercaseHeaders(message.headers);

    return {
        attachments: [],
        bcc: [],
        cc: parseAddressList(headers.cc),
        from: parseAddress(message.from ?? headers.from),
        headers,
        html: nonEmpty(message.html),
        inReplyTo: headers["in-reply-to"],
        messageId: headers["message-id"],
        provider: "cloudflare",
        raw: message,
        references: parseReferences(headers.references),
        replyTo: parseAddress(headers["reply-to"]),
        subject: headers.subject,
        text: nonEmpty(message.text),
        to: parseAddressList(message.to ?? headers.to),
    };
};

export type { CloudflareEmailLike };
export default parseCloudflareInbound;
