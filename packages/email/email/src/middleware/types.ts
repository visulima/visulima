import type { EmailOptions, EmailResult, Result } from "../types";

/**
 * The terminal send function a middleware wraps — ultimately the provider's `sendEmail`.
 */
export type SendFunction = (options: EmailOptions) => Promise<Result<EmailResult>>;

/**
 * A send middleware. Receives the (fully-resolved) message and the `next` function in the chain;
 * may short-circuit, retry, mutate, or observe.
 *
 * Middlewares run in registration order, wrapping outward-in (the first registered runs first and is
 * the outermost wrapper around the provider call).
 * @param options The resolved email options.
 * @param next The next middleware (or the provider send) in the chain.
 * @returns The send result.
 */
export type Middleware = (options: EmailOptions, next: SendFunction) => Promise<Result<EmailResult>>;

/**
 * Composes a middleware stack around a terminal send function.
 * @param middlewares The middlewares, in registration order.
 * @param terminal The provider send call at the centre of the chain.
 * @returns A single {@link SendFunction} that runs the whole chain.
 */
export const composeMiddleware = (middlewares: ReadonlyArray<Middleware>, terminal: SendFunction): SendFunction => {
    let chain = terminal;

    for (const middleware of middlewares.toReversed()) {
        const next = chain;

        chain = (options) => middleware(options, next);
    }

    return chain;
};
