import type { BaseNotificationPayload, ChannelType } from "../types";
import type { Middleware, SendContext } from "./types";

const stringifyRecipient = (value: unknown): string => {
    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value);
};

const defaultResolveRecipient = (payload: BaseNotificationPayload): string | undefined => {
    const { to } = payload as { to?: unknown };

    if (to === undefined || to === null) {
        return undefined;
    }

    if (Array.isArray(to)) {
        return to.map((entry) => stringifyRecipient(entry)).join(",");
    }

    return stringifyRecipient(to);
};

/**
 * Options for {@link suppressionMiddleware}.
 */
export interface SuppressionMiddlewareOptions {
    /** Returns whether a recipient is suppressed on a channel (unsubscribed, hard-bounced); may be async. */
    isSuppressed: (recipient: string, channel: ChannelType) => boolean | Promise<boolean>;
    /** Resolves the recipient identifier from a payload. Defaults to a stringified `payload.to`. */
    resolveRecipient?: (payload: BaseNotificationPayload) => string | undefined;
}

/**
 * Short-circuits sends to suppressed recipients (unsubscribed, hard-bounced, ...). When the resolved
 * recipient is suppressed the send resolves successfully with `sent: false` and a `suppressed:` message
 * id, mirroring how {@link import("./dedupe").dedupeMiddleware} returns a synthetic success.
 *
 * Edge-safe: pure logic with no Node built-ins, so it runs on Cloudflare Workers and other edge runtimes.
 * @param options Suppression check and optional recipient resolver. See {@link SuppressionMiddlewareOptions}.
 * @returns A middleware.
 */
export const suppressionMiddleware = (options: SuppressionMiddlewareOptions): Middleware => {
    const resolveRecipient = options.resolveRecipient ?? defaultResolveRecipient;

    return async (context: SendContext, next) => {
        const recipient = resolveRecipient(context.payload);

        if (recipient === undefined) {
            return next(context);
        }

        const suppressed = await options.isSuppressed(recipient, context.channel);

        if (suppressed) {
            return {
                data: { channel: context.channel, messageId: `suppressed:${recipient}`, provider: context.provider, sent: false, timestamp: new Date() },
                success: true,
            };
        }

        return next(context);
    };
};
