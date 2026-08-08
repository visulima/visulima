import type { ChannelType, MaybePromise, NotificationResult, Result } from "../types";
import type { WebhookHeaders } from "../webhooks/types";

/**
 * The normalised kind of an inbound payload, abstracting over each provider's own taxonomy:
 *
 * - `"message"` — a user-authored message (chat message, SMS, WhatsApp).
 * - `"command"` — a slash / bot command (Slack slash command, Discord application command).
 * - `"callback"` — a UI interaction (Slack block action, Discord component, Telegram callback query).
 * - `"event"` — a provider lifecycle event that is not a direct user message (Slack Events API envelope).
 * - `"unknown"` — a recognised payload that does not map to a more specific kind.
 */
export type InboundMessageType = "callback" | "command" | "event" | "message" | "unknown";

/**
 * A participant in an inbound conversation (the sender, or the bot/recipient).
 */
export interface InboundParticipant {
    /** Provider-native id (Slack user id, Discord user id, phone number, ...). */
    id: string;
    /** Whether the participant is a bot / automated account, when the provider reports it. */
    isBot?: boolean;
    /** Human-readable display name, when available. */
    name?: string;
    /** Handle / username, when available. */
    username?: string;
}

/**
 * A file or media attachment carried by an inbound message.
 */
export interface InboundAttachment {
    /** MIME type, when reported. */
    contentType?: string;
    /** Original filename, when reported. */
    filename?: string;
    /** Provider-native attachment id, when reported. */
    id?: string;
    /** Size in bytes, when reported. */
    size?: number;
    /** URL to fetch the attachment (may require provider auth). */
    url?: string;
}

/**
 * A normalised inbound message. Every channel receiver maps its provider-native payload
 * into this shape so a single handler can process messages from any channel — the
 * counterpart to the outbound {@link ../types.NotificationPayload NotificationPayload}.
 */
export interface InboundMessage {
    /** File / media attachments carried by the message. */
    attachments?: InboundAttachment[];
    /** The logical channel the message arrived on, mirroring {@link ChannelType}. */
    channel: ChannelType;
    /** Parsed command detail when {@link InboundMessage.type} is `"command"`. */
    command?: {
        /** Positional / free-text arguments following the command name. */
        args?: string;
        /** The command name, without any leading `/`. */
        name: string;
    };
    /** Conversation / channel / room / chat id the message belongs to. */
    conversationId?: string;
    /** The sender. */
    from: InboundParticipant;
    /** Provider message / event id. */
    id: string;
    /** Provider extras not covered by a normalised field (team id, guild id, app id, ...). */
    metadata?: Record<string, unknown>;
    /** The provider id: `"slack"`, `"discord"`, `"telegram"`, `"twilio"`. */
    provider: string;
    /** The original, unmodified provider payload. */
    raw: unknown;
    /** Plain-text content, when the payload carries text. */
    text?: string;
    /** Thread / reply anchor, so replies can be threaded where the channel supports it. */
    threadId?: string;
    /** Provider event timestamp (falls back to receive time when the payload omits one). */
    timestamp: Date;
    /** The kind of inbound payload. */
    type: InboundMessageType;
}

/**
 * A normalised reply a handler can return to be delivered in the webhook's HTTP response,
 * where the channel supports synchronous replies (Slack slash commands, Discord
 * interactions, Telegram webhook method calls, Twilio TwiML). For channels that require an
 * out-of-band reply (Slack Events API), send through the matching outbound provider instead.
 */
export interface InboundReply {
    /** Provider-native rich content (Slack blocks, Discord embeds, ...). */
    blocks?: unknown;
    /** Provider-specific fields merged into the serialised response (escape hatch). */
    raw?: Record<string, unknown>;
    /** Plain-text reply body. */
    text?: string;
    /** Reply within the given thread, when the channel supports threading. */
    threadId?: string;
}

/**
 * What {@link InboundContext.reply} accepts: a normalised {@link InboundReply} or, as a
 * shorthand, a plain string treated as `{ text }`.
 */
export type InboundReplyInput = InboundReply | string;

/**
 * Sends a reply back to the originating conversation through the outbound provider configured
 * on the receiver — the out-of-band counterpart to returning an {@link InboundReply} from the
 * handler. Resolves to the provider's send {@link Result}; rejects when no provider was
 * configured. The reply target (recipient, thread) is derived from the inbound message.
 * @param reply The reply content.
 * @returns The provider's send result.
 */
export type InboundReplyFunction = (reply: InboundReplyInput) => Promise<Result<NotificationResult>>;

/**
 * Context passed to an {@link InboundHandler} alongside the parsed message: the verified raw
 * request for handlers that need provider-native fields, plus {@link InboundContext.reply} to
 * answer in a single call.
 */
export interface InboundContext {
    /** The raw request body text, already read and signature-verified. */
    body: string;
    /** Case-insensitive request headers. */
    headers: WebhookHeaders;

    /**
     * Sends a reply to the originating conversation through the receiver's outbound provider.
     * Rejects if no `provider` was passed to the receiver factory.
     */
    reply: InboundReplyFunction;
    /** The originating web-standard {@link Request}. */
    request: Request;
}

/**
 * What an {@link InboundHandler} may return: a normalised {@link InboundReply} (serialised
 * by the channel), a raw web-standard {@link Response} (passed through unchanged), or
 * nothing (the channel acknowledges the delivery with an empty success response).
 */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- `void` keeps a handler that returns nothing (`() => {}`) assignable
export type InboundResponse = InboundReply | Response | void;

/**
 * Handles a verified, parsed inbound message. This is the seam an AI agent plugs into:
 * receive a normalised message, optionally return a reply.
 * @param message The normalised inbound message.
 * @param context The request context.
 * @returns The reply to deliver, a raw response, or nothing.
 */
export type InboundHandler = (message: InboundMessage, context: InboundContext) => MaybePromise<InboundResponse>;

/**
 * The reason an inbound request was rejected before it reached the handler.
 */
export type InboundErrorReason = "invalid_body" | "invalid_signature" | "missing_signature";

/**
 * Options shared by every channel receiver factory.
 */
export interface ReceiverOptions {
    /**
     * Called when a request fails verification or cannot be parsed, before the handler runs.
     * Return a {@link Response} to override the default (`401` for signature failures,
     * `400` for malformed bodies); return nothing to keep the default.
     * @param reason Why the request was rejected.
     * @param request The originating request.
     */
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- allow an error hook that returns nothing to fall through to the default
    onError?: (reason: InboundErrorReason, request: Request) => MaybePromise<Response | void>;

    /** Called for every verified, parsed inbound message. */
    onMessage: InboundHandler;
}

/**
 * A channel receiver: the inbound counterpart to an outbound
 * {@link ../providers/provider.Provider Provider}. It verifies, parses and dispatches
 * inbound webhook requests through a single web-standard entry point.
 */
export interface Receiver {
    /** The logical channel this receiver handles. */
    readonly channel: ChannelType;

    /**
     * Verify, parse and dispatch an inbound webhook request, returning the HTTP response to
     * send back to the provider. Framework-agnostic: pass any web-standard {@link Request}.
     * @param request The inbound webhook request.
     * @returns The response to return to the provider.
     */
    handle: (request: Request) => Promise<Response>;
    /** The provider id this receiver handles. */
    readonly provider: string;
}

/**
 * @deprecated Renamed to {@link Receiver}. Kept as an alias for one major; removed in the next.
 */
export type InboundChannel = Receiver;
