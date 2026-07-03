import type { ChannelPayloadMap, NotificationMessage } from "./notification";

/**
 * Fluent builder for assembling a multi-channel {@link NotificationMessage}.
 *
 * Mirrors the ergonomics of `@visulima/email`'s `MailMessage`: chainable, per-channel
 * setters that accumulate a plain message object. It is a thin convenience over the
 * existing `NotificationMessage` shape and does not change the facade — `build()`
 * returns the exact object `Notification.send()` already accepts.
 * @example
 * ```ts
 * const message = createNotificationMessage()
 *   .sms({ text: "your code is 123", to: "+15555550100" })
 *   .push({ body: "deploy finished", title: "CI", to: "device-token" })
 *   .idempotencyKey("deploy-42")
 *   .build();
 *
 * await createNotification({ sms, push }).send(message);
 * ```
 */
export class NotificationMessageBuilder {
    readonly #message: NotificationMessage = {};

    #metadata: Record<string, unknown> | undefined;

    #idempotencyKey: string | undefined;

    /**
     * Sets the SMS payload for the message.
     * @param payload The SMS channel payload.
     * @returns This instance for method chaining.
     */
    public sms(payload: ChannelPayloadMap["sms"]): this {
        this.#message.sms = payload;

        return this;
    }

    /**
     * Sets the push payload for the message.
     * @param payload The push channel payload.
     * @returns This instance for method chaining.
     */
    public push(payload: ChannelPayloadMap["push"]): this {
        this.#message.push = payload;

        return this;
    }

    /**
     * Sets the chat payload for the message.
     * @param payload The chat channel payload.
     * @returns This instance for method chaining.
     */
    public chat(payload: ChannelPayloadMap["chat"]): this {
        this.#message.chat = payload;

        return this;
    }

    /**
     * Sets the in-app inbox payload for the message.
     * @param payload The in-app channel payload.
     * @returns This instance for method chaining.
     */
    public inApp(payload: ChannelPayloadMap["inapp"]): this {
        this.#message.inapp = payload;

        return this;
    }

    /**
     * Sets the outbound webhook payload for the message.
     * @param payload The webhook channel payload.
     * @returns This instance for method chaining.
     */
    public webhook(payload: ChannelPayloadMap["webhook"]): this {
        this.#message.webhook = payload;

        return this;
    }

    /**
     * Sets the email payload for the message.
     * @param payload The email channel payload.
     * @returns This instance for method chaining.
     */
    public email(payload: ChannelPayloadMap["email"]): this {
        this.#message.email = payload;

        return this;
    }

    /**
     * Sets metadata applied to every present channel payload at build time.
     *
     * Per-channel `metadata` already set on a payload takes precedence over these
     * builder-level values (the builder values are spread first).
     * @param metadata Arbitrary metadata to attach.
     * @returns This instance for method chaining.
     */
    public metadata(metadata: Record<string, unknown>): this {
        this.#metadata = metadata;

        return this;
    }

    /**
     * Sets an idempotency key applied to every present channel payload at build time.
     *
     * A per-channel `idempotencyKey` already set on a payload takes precedence.
     * @param key The idempotency key used to dedupe retried sends.
     * @returns This instance for method chaining.
     */
    public idempotencyKey(key: string): this {
        this.#idempotencyKey = key;

        return this;
    }

    /**
     * Builds the plain {@link NotificationMessage}.
     *
     * Applies builder-level `metadata` / `idempotencyKey` to each present channel
     * payload without overriding values already set on the individual payloads.
     * @returns The assembled multi-channel message.
     */
    public build(): NotificationMessage {
        const metadata = this.#metadata;
        const idempotencyKey = this.#idempotencyKey;

        if (metadata === undefined && idempotencyKey === undefined) {
            return { ...this.#message };
        }

        const result: NotificationMessage = {};
        const channels = Object.keys(this.#message) as (keyof NotificationMessage)[];

        for (const channel of channels) {
            const payload = this.#message[channel];

            if (payload !== undefined) {
                const merged: Record<string, unknown> = {};

                if (metadata !== undefined) {
                    merged.metadata = metadata;
                }

                if (idempotencyKey !== undefined) {
                    merged.idempotencyKey = idempotencyKey;
                }

                Object.assign(merged, payload);

                (result as Record<string, unknown>)[channel] = merged;
            }
        }

        return result;
    }
}

/**
 * Creates a new {@link NotificationMessageBuilder}.
 * @returns A fresh fluent message builder.
 */
export const createNotificationMessage = (): NotificationMessageBuilder => new NotificationMessageBuilder();
