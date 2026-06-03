/**
 * A parsed address from an inbound message.
 */
export interface InboundAddress {
    /**
     * The email address.
     */
    email: string;

    /**
     * The display name, when present.
     */
    name?: string;
}

/**
 * An attachment on an inbound message.
 */
export interface InboundAttachment {
    /**
     * The Content-ID, for inline attachments.
     */
    cid?: string;

    /**
     * Base64-encoded content, when the provider includes it inline.
     */
    content?: string;

    /**
     * The MIME type.
     */
    contentType?: string;

    /**
     * The filename.
     */
    filename: string;

    /**
     * The size in bytes, when reported.
     */
    size?: number;
}

/**
 * A normalized inbound email, produced from any provider's inbound webhook/event payload.
 *
 * This is the common shape every `parse*Inbound` adapter maps onto, so downstream code is
 * provider-agnostic.
 */
export interface InboundEmail {
    /**
     * Attachments included on the message.
     */
    attachments: InboundAttachment[];

    /**
     * Blind carbon-copy recipients.
     */
    bcc: InboundAddress[];

    /**
     * Carbon-copy recipients.
     */
    cc: InboundAddress[];

    /**
     * The sender.
     */
    from?: InboundAddress;

    /**
     * All headers, keyed by lower-cased name.
     */
    headers: Record<string, string>;

    /**
     * The HTML body, when present.
     */
    html?: string;

    /**
     * The `In-Reply-To` header value (a Message-ID), when present.
     */
    inReplyTo?: string;

    /**
     * The canonical `Message-ID` of this message, when present.
     */
    messageId?: string;

    /**
     * The provider this message was parsed from.
     */
    provider: string;

    /**
     * The raw payload the adapter received, for provider-specific fields.
     */
    raw?: unknown;

    /**
     * Message-IDs from the `References` header, oldest first.
     */
    references: string[];

    /**
     * The `Reply-To` address, when present.
     */
    replyTo?: InboundAddress;

    /**
     * The subject line.
     */
    subject?: string;

    /**
     * The plain-text body, when present.
     */
    text?: string;

    /**
     * Primary (`To`) recipients.
     */
    to: InboundAddress[];
}
