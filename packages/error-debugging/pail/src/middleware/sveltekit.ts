import type { WideEvent } from "../wide-event";
import type { PailMiddlewareOptions } from "./shared/create-middleware-logger";
import { createMiddlewareLogger } from "./shared/create-middleware-logger";
import { extractSafeHeaders } from "./shared/headers";
import { createLoggerStorage } from "./shared/storage";

/**
 * A SvelteKit-like event object with access to the pail logger via `locals.log`.
 * @example
 * ```typescript
 * // In a SvelteKit load function or action:
 * import type { PailSvelteKitEvent } from "@visulima/pail/middleware/sveltekit";
 *
 * export const load = async (event: PailSvelteKitEvent) => {
 *   event.locals.log?.set({ user: { id: 1 } });
 * };
 * ```
 */
interface PailSvelteKitEvent {
    [key: string]: unknown;
    locals: Record<string, unknown> & { log?: WideEvent };
    request: Request;
    url: URL;
}

/**
 * Options passed to SvelteKit's resolve function.
 */
interface PailSvelteKitResolveOptions {
    filterSerializedResponseHeaders?: (name: string) => boolean;
    preload?: (input: { type: string }) => boolean;
    transformPageChunk?: (input: { html: string }) => string;
}

/**
 * SvelteKit resolve function type.
 */
type PailSvelteKitResolve = (event: PailSvelteKitEvent, options?: PailSvelteKitResolveOptions) => Promise<Response>;

/**
 * Input for the SvelteKit handle hook.
 */
interface PailSvelteKitHandleInput {
    event: PailSvelteKitEvent;
    resolve: PailSvelteKitResolve;
}

/**
 * SvelteKit handle hook function type returned by `pailHandle()`.
 */
type PailSvelteKitHandle = (input: PailSvelteKitHandleInput) => Promise<Response>;

/**
 * Input for the SvelteKit handleError hook.
 */
interface PailSvelteKitHandleErrorInput {
    error: unknown;
    event: PailSvelteKitEvent;
    message: string;
    status: number;
}

/**
 * SvelteKit handleError hook function type returned by `pailHandleError()`.
 */
type PailSvelteKitHandleError = (input: PailSvelteKitHandleErrorInput) => void;

const loggerStorage = createLoggerStorage("SvelteKit handle hook context. Make sure pailHandle is added to your hooks.server.ts.");

/**
 * Retrieve the request-scoped WideEvent logger from AsyncLocalStorage.
 * Must be called within a request handled by the pail SvelteKit handle hook.
 * @returns The request-scoped WideEvent logger
 * @throws Error if called outside of the hook context
 */
const useLogger = (): WideEvent => loggerStorage.useLogger();

type SvelteKitHandleOptions<T extends string = string> = PailMiddlewareOptions<T>;

/**
 * Create a SvelteKit `handle` hook that attaches a WideEvent logger to each request.
 *
 * The logger is available via:
 * - `event.locals.log` in server load functions and actions
 * - `useLogger()` from anywhere in the async call stack
 *
 * The wide event is automatically emitted when the response is sent or an error occurs.
 * @param options Hook configuration
 * @returns SvelteKit handle hook function
 * @example
 * ```typescript
 * // src/hooks.server.ts
 * import { createPail } from "@visulima/pail";
 * import { pailHandle, pailHandleError } from "@visulima/pail/middleware/sveltekit";
 *
 * const logger = createPail();
 *
 * export const handle = pailHandle({ pail: logger });
 * export const handleError = pailHandleError();
 * ```
 */
export const pailHandle =
    <T extends string = string>(options: SvelteKitHandleOptions<T>): PailSvelteKitHandle =>
    async ({ event, resolve }: PailSvelteKitHandleInput): Promise<Response> => {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        const requestId = event.request.headers.get("x-request-id") ?? crypto.randomUUID();
        const safeHeaders = extractSafeHeaders(event.request.headers);

        const { finish, logger, skipped } = createMiddlewareLogger(options, {
            headers: safeHeaders,
            method: event.request.method,
            path: event.url.pathname,
            requestId,
        });

        if (skipped) {
            return resolve(event);
        }

        // eslint-disable-next-line no-param-reassign
        event.locals.log = logger;

        return loggerStorage.storage.run(logger, async () => {
            try {
                const response = await resolve(event);

                finish({ status: response.status });

                return response;
            } catch (error) {
                finish({ error: error instanceof Error ? error : new Error(String(error)) });
                throw error;
            }
        });
    };

/**
 * Create a SvelteKit `handleError` hook that captures errors into the WideEvent logger.
 *
 * Should be used alongside `pailHandle` to ensure errors are recorded in the wide event.
 * @returns SvelteKit handleError hook function
 */
export const pailHandleError =
    (): PailSvelteKitHandleError =>
    ({ error, event }: PailSvelteKitHandleErrorInput): void => {
        const logger = event.locals.log;

        if (logger && error instanceof Error) {
            logger.error(error.message, error);
        }
    };

/**
 * Convenience function that returns both handle and handleError hooks.
 * @param options Hook configuration
 * @returns Object with `handle` and `handleError` hooks
 * @example
 * ```typescript
 * // src/hooks.server.ts
 * import { createPail } from "@visulima/pail";
 * import { createPailHooks } from "@visulima/pail/middleware/sveltekit";
 *
 * const logger = createPail();
 * const { handle, handleError } = createPailHooks({ pail: logger });
 *
 * export { handle, handleError };
 * ```
 */
export const createPailHooks = <T extends string = string>(
    options: SvelteKitHandleOptions<T>,
): { handle: PailSvelteKitHandle; handleError: PailSvelteKitHandleError } => {
    return {
        handle: pailHandle(options),
        handleError: pailHandleError(),
    };
};

export { useLogger };
export type {
    PailSvelteKitEvent,
    PailSvelteKitHandle,
    PailSvelteKitHandleError,
    PailSvelteKitHandleErrorInput,
    PailSvelteKitHandleInput,
    PailSvelteKitResolve,
    PailSvelteKitResolveOptions,
    SvelteKitHandleOptions,
};
export type { WideEvent } from "../wide-event";
