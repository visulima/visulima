import { randomUUID } from "node:crypto";

import type { EventBus } from "../events";
import type { EmailAddress } from "../types";
import type { Middleware } from "./types";

const firstRecipient = (to: EmailAddress | EmailAddress[]): string | undefined => {
    const recipient = Array.isArray(to) ? to[0] : to;

    return recipient?.email;
};

/**
 * Options for {@link withEvents}.
 */
export interface EventsMiddlewareOptions {
    /**
     * Generates event ids. Defaults to `crypto.randomUUID`.
     */
    idFactory?: () => string;

    /**
     * Time source in milliseconds — injectable for tests. Defaults to `Date.now`.
     */
    now?: () => number;
}

/**
 * Emits unified `EmailEvent`s onto an {@link EventBus} around each send: `queued` before, then
 * `sent` or `failed` after. Combine with webhook-derived events for a single timeline per message.
 * @param bus The event bus to publish to.
 * @param options Middleware options. See {@link EventsMiddlewareOptions}.
 * @returns A middleware that publishes send-lifecycle events.
 */
export const withEvents = (bus: EventBus, options: EventsMiddlewareOptions = {}): Middleware => {
    const { idFactory = randomUUID, now = Date.now } = options;

    return async (email, next) => {
        const recipient = firstRecipient(email.to);

        bus.emit({ id: idFactory(), recipient, timestamp: new Date(now()), type: "queued" });

        const result = await next(email);

        if (result.success) {
            bus.emit({
                id: idFactory(),
                messageId: result.data?.messageId,
                provider: result.data?.provider,
                recipient,
                timestamp: new Date(now()),
                type: "sent",
            });
        } else {
            bus.emit({
                data: { error: result.error instanceof Error ? result.error.message : String(result.error) },
                id: idFactory(),
                recipient,
                timestamp: new Date(now()),
                type: "failed",
            });
        }

        return result;
    };
};
