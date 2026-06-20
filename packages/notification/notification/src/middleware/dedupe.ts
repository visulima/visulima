import type { Middleware, SendContext } from "./types";

export interface DedupeMiddlewareOptions {
    /** Derive the dedupe key (default: `payload.idempotencyKey`). */
    keyFn?: (context: SendContext) => string | undefined;
    /** How long a key is remembered, in ms (default 60000). */
    ttl?: number;
}

/**
 * Suppresses duplicate sends within a TTL window, keyed by idempotency key. A suppressed
 * send resolves successfully with `sent: false` and a `deduped:` message id.
 * @param options Custom `keyFn` and `ttl` (ms) controlling how keys are derived and expire.
 * @returns A middleware.
 */
export const dedupeMiddleware = (options: DedupeMiddlewareOptions = {}): Middleware => {
    const ttl = options.ttl ?? 60_000;
    const seen = new Map<string, number>();

    return async (context, next) => {
        const key = options.keyFn ? options.keyFn(context) : context.payload.idempotencyKey;

        if (!key) {
            return next(context);
        }

        const now = Date.now();

        for (const [existing, expiry] of seen) {
            if (expiry < now) {
                seen.delete(existing);
            }
        }

        if (seen.has(key)) {
            return {
                data: { channel: context.channel, messageId: `deduped:${key}`, provider: context.provider, sent: false, timestamp: new Date() },
                success: true,
            };
        }

        const result = await next(context);

        if (result.success) {
            seen.set(key, now + ttl);
        }

        return result;
    };
};
