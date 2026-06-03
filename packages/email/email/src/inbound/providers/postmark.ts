import type { InboundAddress, InboundAttachment, InboundEmail } from "../types";
import { nonEmpty } from "../utils";

interface PostmarkFullAddress {
    Email?: string;
    Name?: string;
}

interface PostmarkInboundPayload {
    [key: string]: unknown;
    Attachments?: { Content?: string; ContentID?: string; ContentLength?: number; ContentType?: string; Name?: string }[];
    BccFull?: PostmarkFullAddress[];
    CcFull?: PostmarkFullAddress[];
    FromFull?: PostmarkFullAddress;
    Headers?: { Name?: string; Value?: string }[];
    HtmlBody?: string;
    MessageID?: string;
    ReplyTo?: string;
    Subject?: string;
    TextBody?: string;
    ToFull?: PostmarkFullAddress[];
}

const toAddress = (full: PostmarkFullAddress | undefined): InboundAddress | undefined => {
    if (!full?.Email) {
        return undefined;
    }

    return full.Name ? { email: full.Email, name: full.Name } : { email: full.Email };
};

const toAddresses = (list: PostmarkFullAddress[] | undefined): InboundAddress[] =>
    (list ?? []).map((entry) => toAddress(entry)).filter((address): address is InboundAddress => address !== undefined);

/**
 * Parses a [Postmark inbound](https://postmarkapp.com/developer/webhooks/inbound-webhook) webhook
 * payload into the normalized {@link InboundEmail} shape.
 * @param payload The parsed JSON body of the Postmark inbound webhook.
 * @returns The normalized inbound email.
 */
const parsePostmarkInbound = (payload: PostmarkInboundPayload): InboundEmail => {
    const headers: Record<string, string> = {};

    for (const header of payload.Headers ?? []) {
        if (header.Name) {
            headers[header.Name.toLowerCase()] = header.Value ?? "";
        }
    }

    // `[^<>]` (not `[^>]`) keeps this linear: an unclosed run of "<" can't trigger O(n²) backtracking.
    const references = (headers.references ?? "").match(/<[^<>]+>/g) ?? [];

    const attachments: InboundAttachment[] = (payload.Attachments ?? []).map((attachment) => {
        return {
            cid: attachment.ContentID,
            content: attachment.Content,
            contentType: attachment.ContentType,
            filename: attachment.Name ?? "attachment",
            size: attachment.ContentLength,
        };
    });

    return {
        attachments,
        bcc: toAddresses(payload.BccFull),
        cc: toAddresses(payload.CcFull),
        from: toAddress(payload.FromFull),
        headers,
        html: nonEmpty(payload.HtmlBody),
        inReplyTo: headers["in-reply-to"],
        // Prefer the RFC 5322 Message-ID header (what inReplyTo/references reference) over Postmark's
        // internal MessageID, so thread stitching links replies correctly.
        messageId: headers["message-id"] ?? (payload.MessageID ? `<${payload.MessageID}>` : undefined),
        provider: "postmark",
        raw: payload,
        references,
        replyTo: payload.ReplyTo ? { email: payload.ReplyTo } : undefined,
        subject: payload.Subject,
        text: nonEmpty(payload.TextBody),
        to: toAddresses(payload.ToFull),
    };
};

export default parsePostmarkInbound;
