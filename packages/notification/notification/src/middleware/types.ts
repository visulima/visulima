import type { BaseNotificationPayload, ChannelType, NotificationResult, Result } from "../types";

/**
 * Context passed through the middleware chain for a single send.
 */
export interface SendContext {
    /** The channel being sent on. */
    channel: ChannelType;
    /** The (possibly mutated) payload. */
    payload: BaseNotificationPayload;
    /** The provider id handling the send. */
    provider: string;
}

/**
 * The terminal send function and the type middleware wrap.
 */
export type SendFunction = (context: SendContext) => Promise<Result<NotificationResult>>;

/**
 * A middleware wraps a {@link SendFunction}. The first registered middleware is the
 * outermost wrapper (runs first on the way in, last on the way out).
 */
export type Middleware = (context: SendContext, next: SendFunction) => Promise<Result<NotificationResult>>;

/**
 * Composes middleware around a terminal send function.
 * @param middlewares Middleware in registration order.
 * @param terminal The terminal send function.
 * @returns A single composed send function.
 */
export const composeMiddleware = (middlewares: Middleware[], terminal: SendFunction): SendFunction => {
    let chain = terminal;

    for (const middleware of middlewares.toReversed()) {
        const next = chain;

        chain = (context: SendContext) => middleware(context, next);
    }

    return chain;
};
