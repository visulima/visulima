import { AsyncLocalStorage } from "node:async_hooks";

import type { WideEvent, WideEventFinishOptions } from "../wide-event";
import type { PailMiddlewareOptions } from "./shared/create-middleware-logger";
import { createMiddlewareLogger } from "./shared/create-middleware-logger";
import { extractSafeHeaders } from "./shared/headers";

/**
 * An Elysia-like instance that supports the derive/hook registration API.
 * Compatible with Elysia v1+.
 */
interface PailElysiaInstance {
    derive: (options: { as: string }, handler: (context: { request: Request }) => Record<string, unknown>) => PailElysiaInstance;
    onAfterHandle: (options: { as: string }, handler: (context: { request: Request; set: { status?: number } }) => Promise<void>) => PailElysiaInstance;
    onError: (options: { as: string }, handler: (context: { error: Error; request: Request }) => Promise<void>) => PailElysiaInstance;
}

interface RequestState {
    finish: (options?: WideEventFinishOptions) => void;
    logger: WideEvent;
    skipped: boolean;
}

const storage = new AsyncLocalStorage<WideEvent>();
const activeLoggers = new WeakSet<WideEvent>();

/**
 * `AsyncLocalStorage.enterWith()` is optional: `node:async_hooks` is available on
 * workerd/Cloudflare Workers (and other edge runtimes) but `enterWith()` throws
 * "not implemented" there. Elysia's `derive` hook cannot wrap the rest of the
 * request in `storage.run()`, so the ambient accessor is simply unavailable on
 * those runtimes.
 *
 * Holds the last rejection rather than latching a "not supported" flag. A runtime
 * that refuses `enterWith()` refuses it every time, so retrying costs one throw per
 * request there and nothing at all elsewhere — while a one-off failure can no longer
 * disable the accessor for the rest of the process, and the diagnostic below quotes
 * what actually went wrong instead of asserting a cause it never observed.
 */
let lastEnterWithFailure: string | undefined;

/**
 * Binds `logger` to the ambient async context when the runtime allows it.
 * @param logger The request-scoped wide event to bind.
 * @returns `true` when the binding took effect, `false` when the runtime rejected it.
 */
const enterAmbientContext = (logger: WideEvent): boolean => {
    try {
        storage.enterWith(logger);
        lastEnterWithFailure = undefined;

        return true;
    } catch (error) {
        lastEnterWithFailure = error instanceof Error ? error.message : String(error);

        return false;
    }
};

/**
 * Retrieve the request-scoped WideEvent logger from AsyncLocalStorage.
 * Must be called within a request handler where pail middleware is active.
 *
 * Not available on runtimes that reject `AsyncLocalStorage.enterWith()` (workerd and
 * other edge runtimes); use the `log` property on the handler context instead.
 * @returns The request-scoped WideEvent logger
 * @throws Error if called outside of the middleware context
 */
const useLogger = (): WideEvent => {
    const logger = storage.getStore();

    if (!logger || !activeLoggers.has(logger)) {
        if (lastEnterWithFailure !== undefined) {
            throw new Error(
                `[pail] useLogger() is unavailable here: AsyncLocalStorage.enterWith() was rejected by this runtime with "${lastEnterWithFailure}". Use the \`log\` property on the Elysia handler context instead.`,
            );
        }

        throw new Error("[pail] useLogger() called outside of Elysia pail plugin context.");
    }

    return logger;
};

/**
 * Configuration options for the Elysia pail plugin.
 * @template T - Custom logger type names from the pail instance
 */
type ElysiaPluginOptions<T extends string = string> = PailMiddlewareOptions<T>;

/**
 * Register pail wide event logging as an Elysia plugin.
 *
 * Injects a `log` property into handler context via `derive`, accessible via:
 * - `context.log` in route handlers (auto-injected)
 * - `useLogger()` from anywhere in the async call stack
 *
 * The wide event is automatically emitted on response or error.
 * @param app The Elysia instance
 * @param options Plugin configuration
 * @returns The Elysia instance (for chaining)
 * @example
 * ```typescript
 * import { Elysia } from "elysia";
 * import { createPail } from "@visulima/pail";
 * import { pailPlugin, useLogger } from "@visulima/pail/middleware/elysia";
 *
 * const logger = createPail();
 * const app = new Elysia();
 *
 * pailPlugin(app, { pail: logger });
 *
 * app.get("/api/users", ({ log }) => {
 *   log.set({ user: { id: 1 } });
 *   return { ok: true };
 * });
 * ```
 */
export const pailPlugin = <T extends string = string>(app: PailElysiaInstance, options: ElysiaPluginOptions<T>): PailElysiaInstance => {
    const requestState = new WeakMap<Request, RequestState>();
    const emitted = new WeakSet<Request>();

    return (
        app
            .derive({ as: "global" }, ({ request }: { request: Request }) => {
                const url = new URL(request.url);
                // eslint-disable-next-line n/no-unsupported-features/node-builtins
                const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
                const safeHeaders = extractSafeHeaders(request.headers);

                const result = createMiddlewareLogger(options, {
                    headers: safeHeaders,
                    method: request.method,
                    path: url.pathname,
                    requestId,
                });

                requestState.set(request, result);

                if (!result.skipped) {
                    activeLoggers.add(result.logger);
                    enterAmbientContext(result.logger);
                }

                return { log: result.logger };
            })
            // eslint-disable-next-line @typescript-eslint/require-await -- Elysia hook signature requires Promise<void>
            .onAfterHandle({ as: "global" }, async ({ request, set }: { request: Request; set: { status?: number } }) => {
                const state = requestState.get(request);

                if (!state?.skipped && state && !emitted.has(request)) {
                    emitted.add(request);
                    state.finish({ status: set.status ?? 200 });
                    activeLoggers.delete(state.logger);
                }
            })
            // eslint-disable-next-line @typescript-eslint/require-await -- Elysia hook signature requires Promise<void>
            .onError({ as: "global" }, async ({ error, request }: { error: Error; request: Request }) => {
                const state = requestState.get(request);

                if (!state?.skipped && state && !emitted.has(request)) {
                    emitted.add(request);
                    state.finish({ error });
                    activeLoggers.delete(state.logger);
                }
            })
    );
};

export { useLogger };
export type { ElysiaPluginOptions, PailElysiaInstance };
export type { WideEvent } from "../wide-event";
