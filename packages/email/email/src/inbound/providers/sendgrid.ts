import type { InboundEmail } from "../types";
import { nonEmpty, parseAddress, parseAddressList, parseReferences } from "../utils";

interface SendGridInboundPayload {
    [key: string]: unknown;
    cc?: string;
    from?: string;
    headers?: string;
    html?: string;
    subject?: string;
    text?: string;
    to?: string;
}

/**
 * Parses the raw `headers` blob from SendGrid's Inbound Parse into a lower-cased record.
 * @param raw The raw header block.
 * @returns The parsed headers.
 */
const parseRawHeaders = (raw: string | undefined): Record<string, string> => {
    const headers: Record<string, string> = {};

    if (!raw) {
        return headers;
    }

    for (const line of raw.replaceAll("\r\n", "\n").split("\n")) {
        const colonIndex = line.indexOf(":");

        if (colonIndex > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
            headers[line.slice(0, colonIndex).trim().toLowerCase()] = line.slice(colonIndex + 1).trim();
        }
    }

    return headers;
};

/**
 * Parses a [SendGrid Inbound Parse](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
 * payload (the multipart fields, already decoded into an object) into the normalized
 * {@link InboundEmail} shape.
 * @param payload The decoded Inbound Parse fields.
 * @returns The normalized inbound email.
 */
const parseSendGridInbound = (payload: SendGridInboundPayload): InboundEmail => {
    const headers = parseRawHeaders(payload.headers);

    return {
        attachments: [],
        bcc: [],
        cc: parseAddressList(payload.cc),
        from: parseAddress(payload.from),
        headers,
        html: nonEmpty(payload.html),
        inReplyTo: headers["in-reply-to"],
        messageId: headers["message-id"],
        provider: "sendgrid",
        raw: payload,
        references: parseReferences(headers.references),
        replyTo: parseAddress(headers["reply-to"]),
        subject: payload.subject,
        text: nonEmpty(payload.text),
        to: parseAddressList(payload.to),
    };
};

export default parseSendGridInbound;
