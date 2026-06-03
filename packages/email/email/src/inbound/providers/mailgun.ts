import type { InboundEmail } from "../types";
import { nonEmpty, parseAddress, parseAddressList, parseReferences } from "../utils";

interface MailgunInboundPayload {
    [key: string]: unknown;
    "body-html"?: string;
    "body-plain"?: string;
    cc?: string;
    from?: string;
    "message-headers"?: [string, string][] | string;
    "Message-Id"?: string;
    recipient?: string;
    sender?: string;
    "stripped-html"?: string;
    "stripped-text"?: string;
    subject?: string;
    To?: string;
}

/**
 * Normalizes Mailgun's `message-headers` (a JSON array of `[name, value]` pairs, sometimes delivered
 * as a string) into a lower-cased record.
 * @param raw The `message-headers` field.
 * @returns The parsed headers.
 */
const parseMessageHeaders = (raw: [string, string][] | string | undefined): Record<string, string> => {
    const headers: Record<string, string> = {};

    if (!raw) {
        return headers;
    }

    let pairs: [string, string][];

    if (typeof raw === "string") {
        try {
            pairs = JSON.parse(raw) as [string, string][];
        } catch {
            return headers;
        }
    } else {
        pairs = raw;
    }

    for (const [name, value] of pairs) {
        if (name) {
            headers[name.toLowerCase()] = value;
        }
    }

    return headers;
};

/**
 * Canonicalizes a Message-ID to the angle-bracketed RFC 5322 form. Mailgun delivers the value
 * bracketed in `message-headers` but often bare in the top-level `Message-Id` field; normalizing both
 * keeps `inReplyTo`/`references` comparisons consistent.
 * @param value The raw Message-ID value (bare or bracketed).
 * @returns The bracketed Message-ID, or `undefined` when there is no value.
 */
const canonicalizeMessageId = (value: string | undefined): string | undefined => {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();

    return trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed : `<${trimmed}>`;
};

/**
 * Parses a [Mailgun inbound](https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/)
 * route payload into the normalized {@link InboundEmail} shape.
 * @param payload The parsed form fields of the Mailgun inbound request.
 * @returns The normalized inbound email.
 */
const parseMailgunInbound = (payload: MailgunInboundPayload): InboundEmail => {
    const headers = parseMessageHeaders(payload["message-headers"]);

    return {
        attachments: [],
        bcc: [],
        cc: parseAddressList(payload.cc),
        from: parseAddress(payload.from ?? payload.sender),
        headers,
        html: nonEmpty(payload["body-html"]),
        inReplyTo: headers["in-reply-to"],
        messageId: canonicalizeMessageId(payload["Message-Id"] ?? headers["message-id"]),
        provider: "mailgun",
        raw: payload,
        references: parseReferences(headers.references),
        replyTo: parseAddress(headers["reply-to"]),
        subject: payload.subject,
        text: nonEmpty(payload["stripped-text"] ?? payload["body-plain"]),
        to: parseAddressList(payload.To ?? payload.recipient),
    };
};

export default parseMailgunInbound;
