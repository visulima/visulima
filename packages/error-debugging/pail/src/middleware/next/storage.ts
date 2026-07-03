import { AsyncLocalStorage } from "node:async_hooks";

import type { WideEvent } from "../../wide-event";

/**
 * AsyncLocalStorage instance used to propagate the WideEvent logger
 * through Next.js server actions, route handlers, and server components.
 */
export const pailStorage: AsyncLocalStorage<WideEvent> = new AsyncLocalStorage<WideEvent>();

/**
 * Retrieve the request-scoped WideEvent logger from AsyncLocalStorage.
 * Must be called within a `withPail()` wrapped handler or server action.
 * @returns The request-scoped WideEvent logger
 * @throws Error if called outside of a withPail context
 */
export const useLogger = (): WideEvent => {
    const logger = pailStorage.getStore();

    if (!logger) {
        throw new Error("[pail] useLogger() called outside of withPail() context. Wrap your route handler or server action with withPail().");
    }

    return logger;
};
