type EmailRecipients = EmailAddressLike | string | (EmailAddressLike | string)[];

/**
 * Utility type for values that can be promises.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * The logical delivery channels a notification can be routed through.
 */
export type ChannelType = "chat" | "email" | "inapp" | "push" | "sms" | "webhook";

/**
 * Feature flags indicating what capabilities a provider supports. Used to gate
 * payloads before sending (see `checkFeatureSupport`) and to surface capabilities
 * to consumers.
 */
export interface FeatureFlags {
    /** Supports file/media attachments (MMS, rich push images). */
    attachments?: boolean;
    /** Supports sending to many recipients in a single API call. */
    batchSending?: boolean;
    /** Reports delivery receipts / status callbacks. */
    deliveryReceipts?: boolean;
    /** Supports media URLs (MMS images, push images). */
    media?: boolean;
    /** Supports rich structured content (Slack blocks, cards, action buttons). */
    richContent?: boolean;
    /** Supports scheduled / delayed sending. */
    scheduling?: boolean;
    /** Supports provider-side templates. */
    templates?: boolean;
    /** Supports open/click tracking. */
    tracking?: boolean;
}

/**
 * Base configuration shared by every provider.
 */
export interface BaseConfig {
    debug?: boolean;
    logger?: Console;
    retries?: number;
    timeout?: number;
}

/**
 * Fields common to every channel payload.
 */
export interface BaseNotificationPayload {
    /**
     * Idempotency key to dedupe retried sends at the provider (where supported)
     * and in the dedupe middleware.
     */
    idempotencyKey?: string;

    /**
     * Arbitrary metadata passed through to the provider and emitted on events.
     */
    metadata?: Record<string, unknown>;

    /**
     * Optional scheduled send time (providers advertising `scheduling`).
     */
    scheduledAt?: Date | string;
}

/**
 * SMS / MMS payload.
 */
export interface SmsPayload extends BaseNotificationPayload {
    /** Sender id or phone number (overrides provider default). */
    from?: string;
    /** Media URLs for MMS. */
    mediaUrls?: string[];
    /** Message body. */
    text: string;
    /** Destination phone number(s) in E.164 format. */
    to: string | string[];
}

/**
 * Push notification payload (mobile + web push).
 */
export interface PushPayload extends BaseNotificationPayload {
    /** Badge count (iOS). */
    badge?: number;
    /** Notification body. */
    body: string;
    /** Action invoked when the notification is tapped. */
    clickAction?: string;
    /** Custom key/value data payload. */
    data?: Record<string, unknown>;
    /** Image URL for rich push. */
    imageUrl?: string;
    /** Sound to play. */
    sound?: string;
    /** Notification title. */
    title?: string;
    /** Device token(s) / subscription target(s). */
    to: string | string[];
}

/**
 * Chat payload (Slack, Discord, Teams, Telegram, ...).
 */
export interface ChatPayload extends BaseNotificationPayload {
    /** Provider-specific rich content (Slack blocks, Discord embeds, ...). */
    blocks?: unknown;
    /** Plain-text message body. */
    text: string;
    /** Thread / reply target. */
    threadId?: string;
    /** Channel id, conversation id or webhook target (overrides provider default). */
    to?: string;
}

/**
 * In-app inbox payload.
 */
export interface InAppPayload extends BaseNotificationPayload {
    /** Optional CTA actions. */
    actions?: { label: string; url?: string }[];
    /** Notification body. */
    body: string;
    /** Custom key/value data payload. */
    data?: Record<string, unknown>;
    /** Notification title. */
    title?: string;
    /** Subscriber id the notification belongs to. */
    to: string;
}

/**
 * An email address, optionally with a display name.
 */
export interface EmailAddressLike {
    email: string;
    name?: string;
}

/**
 * Email channel payload. Delivered through `@visulima/email` by the email channel adapter;
 * the shape mirrors `EmailOptions` so it passes through with minimal mapping.
 */
export interface EmailChannelPayload extends BaseNotificationPayload {
    attachments?: unknown[];
    bcc?: EmailRecipients;
    cc?: EmailRecipients;
    from?: EmailAddressLike | string;
    headers?: Record<string, string>;
    html?: string;
    replyTo?: EmailAddressLike | string;
    subject: string;
    text?: string;
    to: EmailRecipients;
}

/**
 * Generic outbound webhook payload.
 */
export interface WebhookPayload extends BaseNotificationPayload {
    /** JSON-serialisable request body. */
    body: unknown;
    /** Extra request headers. */
    headers?: Record<string, string>;
    /** HTTP method (defaults to POST). */
    method?: string;
    /** Target URL (overrides provider default). */
    url?: string;
}

/**
 * Union of all built-in channel payloads.
 */
export type NotificationPayload = ChatPayload | EmailChannelPayload | InAppPayload | PushPayload | SmsPayload | WebhookPayload;

/**
 * Per-recipient delivery outcome for multi-recipient sends.
 */
export interface RecipientResult {
    error?: string;
    id: string;
    messageId?: string;
    status: "failed" | "sent";
}

/**
 * Normalised result of a successful provider send.
 */
export interface NotificationResult {
    channel?: ChannelType;
    messageId: string;
    provider?: string;
    /** Per-recipient breakdown when a single call targets many recipients. */
    recipients?: RecipientResult[];
    response?: unknown;
    sent: boolean;
    timestamp: Date;
}

/**
 * A successful send receipt.
 */
export interface SuccessReceipt {
    channel?: ChannelType;
    messageId: string;
    provider?: string;
    response?: unknown;
    successful: true;
    timestamp: Date;
}

/**
 * A failed send receipt.
 */
export interface FailureReceipt {
    channel?: ChannelType;
    errorMessages: string[];
    provider?: string;
    successful: false;
}

/**
 * Discriminated send receipt returned by the high-level facade.
 */
export type Receipt = FailureReceipt | SuccessReceipt;

/**
 * Generic result tuple used across providers and middleware.
 */
export interface Result<T = unknown> {
    data?: T;
    error?: unknown;
    success: boolean;
}

/**
 * Lifecycle event names emitted on the event bus and parsed from provider webhooks.
 */
export type NotificationEventType = "bounced" | "clicked" | "delivered" | "failed" | "interacted" | "queued" | "read" | "sent";

/**
 * Normalised lifecycle / delivery event.
 */
export interface NotificationEvent {
    channel?: ChannelType;
    messageId: string;
    metadata?: Record<string, unknown>;
    provider?: string;
    recipient?: string;
    timestamp: Date;
    type: NotificationEventType;
}
