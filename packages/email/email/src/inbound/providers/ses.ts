import type { InboundEmail } from "../types";
import { nonEmpty, parseAddress, parseAddressList, parseReferences } from "../utils";

interface SesCommonHeaders {
    cc?: string[];
    from?: string[];
    messageId?: string;
    replyTo?: string[];
    subject?: string;
    to?: string[];
}

interface SesMail {
    commonHeaders?: SesCommonHeaders;
    headers?: { name?: string; value?: string }[];
    messageId?: string;
    source?: string;
}

interface SesInboundPayload {
    [key: string]: unknown;
    content?: string;
    html?: string;
    mail?: SesMail;
    text?: string;
}

/**
 * Parses an [Amazon SES inbound](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-lambda.html)
 * notification (the `mail` object, typically delivered via SNS/Lambda) into the normalized
 * {@link InboundEmail} shape.
 *
 * SES does not include the decoded body in the notification — fetch it from S3 (or pass it directly)
 * and supply it via `text`/`html`.
 * @param payload The SES notification, with optional decoded body.
 * @returns The normalized inbound email.
 */
const parseSesInbound = (payload: SesInboundPayload): InboundEmail => {
    const mail = payload.mail ?? {};
    const common = mail.commonHeaders ?? {};

    const headers: Record<string, string> = {};

    for (const header of mail.headers ?? []) {
        if (header.name) {
            headers[header.name.toLowerCase()] = header.value ?? "";
        }
    }

    return {
        attachments: [],
        bcc: [],
        cc: (common.cc ?? []).flatMap((value) => parseAddressList(value)),
        from: parseAddress(common.from?.[0] ?? mail.source),
        headers,
        html: nonEmpty(payload.html),
        inReplyTo: headers["in-reply-to"],
        // Prefer the RFC 5322 Message-ID header (commonHeaders.messageId / the message-id header) over
        // the SES-assigned mail.messageId, so thread stitching links replies correctly.
        messageId: common.messageId ?? headers["message-id"] ?? (mail.messageId ? `<${mail.messageId}>` : undefined),
        provider: "ses",
        raw: payload,
        references: parseReferences(headers.references),
        replyTo: parseAddress(common.replyTo?.[0]),
        subject: common.subject,
        text: nonEmpty(payload.text),
        to: (common.to ?? []).flatMap((value) => parseAddressList(value)),
    };
};

export default parseSesInbound;
