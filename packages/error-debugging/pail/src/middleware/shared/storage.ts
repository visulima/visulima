import { AsyncLocalStorage } from "node:async_hooks";

import type { WideEvent } from "../../wide-event";

/**
 * Create an isolated AsyncLocalStorage instance and a `useLogger` accessor
 * for retrieving the request-scoped WideEvent from anywhere in the call stack.
 *
 * Each framework adapter should call this once at module level to get its own
 * isolated storage instance.
 * @param contextHint A description of the expected context, used in the
 * error message when `useLogger` is called outside of a request scope.
 * @returns An object with `storage` and `useLogger`
 * @example
 * ```typescript
 * const { storage, useLogger } = createLoggerStorage(
 *   "Express middleware context. Make sure evlog middleware is registered."
 * );
 *
 * // In middleware:
 * storage.run(wideEvent, () => next());
 *
 * // In handler:
 * const log = useLogger();
 * log.set({ user: { id: 1 } });
 * ```
 */
// eslint-disable-next-line import/prefer-default-export
export const createLoggerStorage = (contextHint: string): { storage: AsyncLocalStorage<WideEvent>; useLogger: () => WideEvent } => {
    const storage = new AsyncLocalStorage<WideEvent>();

    /**
     * Retrieve the request-scoped WideEvent logger from AsyncLocalStorage.
     * Must be called within a request context set up by the framework middleware.
     * @throws Error if called outside of the middleware context
     */
    const useLogger = (): WideEvent => {
        const logger = storage.getStore();

        if (!logger) {
            throw new Error(`[pail] useLogger() called outside of ${contextHint}`);
        }

        return logger;
    };

    return { storage, useLogger };
};
