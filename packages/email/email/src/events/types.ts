/**
 * The lifecycle/engagement event types that converge onto a single {@link EmailEvent} shape.
 *
 * The first group (`queued` → `failed`) is emitted by the send pipeline; the rest typically originate
 * from provider webhooks (delivery/engagement signals).
 */
export type EmailEventType
    = | "attempt"
        | "bounced"
        | "clicked"
        | "complained"
        | "deferred"
        | "delivered"
        | "failed"
        | "opened"
        | "queued"
        | "sent"
        | "unsubscribed";

/**
 * A single, provider-agnostic email event. Both internal send-lifecycle signals and normalized
 * webhook events use this shape so a timeline can be reconstructed from one stream.
 */
export interface EmailEvent {
    /**
     * Arbitrary structured payload (provider response, bounce sub-type, click URL, …).
     */
    data?: Record<string, unknown>;

    /**
     * A unique id for this event.
     */
    id: string;

    /**
     * The message this event concerns.
     */
    messageId?: string;

    /**
     * The provider that produced (or will produce) the message.
     */
    provider?: string;

    /**
     * The recipient address this event concerns, when applicable.
     */
    recipient?: string;

    /**
     * When the event occurred.
     */
    timestamp: Date;

    /**
     * The kind of event.
     */
    type: EmailEventType;
}

/**
 * A listener invoked for matching {@link EmailEvent}s.
 */
export type EmailEventListener = (event: EmailEvent) => void;

/**
 * A persistence backend for {@link EmailEvent}s.
 */
export interface EventStore {
    /**
     * Appends an event.
     * @param event The event to store.
     */
    append: (event: EmailEvent) => Promise<void> | void;

    /**
     * Returns the full, time-ordered timeline for a message.
     * @param messageId The message to reconstruct.
     */
    timeline: (messageId: string) => EmailEvent[] | Promise<EmailEvent[]>;
}
