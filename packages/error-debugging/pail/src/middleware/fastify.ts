import type { WideEvent, WideEventFinishOptions } from "../wide-event";
import type { PailMiddlewareOptions } from "./shared/create-middleware-logger";
import { createMiddlewareLogger } from "./shared/create-middleware-logger";
import { extractSafeNodeHeaders } from "./shared/headers";
import { createLoggerStorage } from "./shared/storage";

/**
 * A Fastify-like request object with the pail logger attached.
 * Use this to type your route handlers when accessing `request.log`.
 * @example
 * ```typescript
 * import type { PailFastifyRequest } from "@visulima/pail/middleware/fastify";
 *
 * app.get("/api/users", async (request: PailFastifyRequest, reply) => {
 *   request.log?.set({ user: { id: 1 } });
 * });
 * ```
 */
interface PailFastifyRequest {
    [key: string]: unknown;
    headers: Record<string, string | string[] | undefined>;

    /**
     * The request-scoped WideEvent logger, attached by pail plugin.
     * Only present for non-excluded routes.
     */
    log?: WideEvent;
    method: string;
    url: string;
}

/**
 * A Fastify-like reply object.
 */
interface PailFastifyReply {
    [key: string]: unknown;
    statusCode: number;
}

/**
 * A Fastify-like instance that supports the hook registration API.
 */
interface PailFastifyInstance {
    addHook: ((name: "onError", hook: (request: PailFastifyRequest, reply: PailFastifyReply, error: Error) => Promise<void>) => void)
        & ((name: "onRequest", hook: (request: PailFastifyRequest, reply: PailFastifyReply, done: () => void) => void) => void)
        & ((name: "onResponse", hook: (request: PailFastifyRequest, reply: PailFastifyReply) => Promise<void>) => void);
}

const loggerStorage = createLoggerStorage("Fastify middleware context. Make sure pail plugin is registered before your route handlers.");

/**
 * Retrieve the request-scoped WideEvent logger from AsyncLocalStorage.
 * Must be called within a request handled by the pail Fastify plugin.
 * @returns The request-scoped WideEvent logger
 * @throws Error if called outside of the plugin context
 */
const useLogger = (): WideEvent => loggerStorage.useLogger();

/**
 * Configuration options for the Fastify pail plugin.
 * @template T - Custom logger type names from the pail instance
 */
type FastifyPluginOptions<T extends string = string> = PailMiddlewareOptions<T>;

interface RequestState {
    finish: (options?: WideEventFinishOptions) => void;
}

/**
 * Register pail wide event logging as a Fastify plugin.
 *
 * Attaches a WideEvent logger to each request, accessible via:
 * - `request.log` on the Fastify request object
 * - `useLogger()` from anywhere in the async call stack
 *
 * The wide event is automatically emitted on response or error.
 * @param fastify The Fastify instance
 * @param options Plugin configuration
 * @example
 * ```typescript
 * import Fastify from "fastify";
 * import { createPail } from "@visulima/pail";
 * import { pailPlugin, useLogger } from "@visulima/pail/middleware/fastify";
 *
 * const app = Fastify();
 * const logger = createPail();
 *
 * pailPlugin(app, { pail: logger });
 *
 * app.get("/api/users", async (request, reply) => {
 *   request.log.set({ user: { id: 1 } });
 *   return { ok: true };
 * });
 * ```
 */
export const pailPlugin = <T extends string = string>(fastify: PailFastifyInstance, options: FastifyPluginOptions<T>): void => {
    const requestState = new WeakMap<object, RequestState>();
    const emitted = new WeakSet<object>();

    fastify.addHook("onRequest", (request: PailFastifyRequest, _reply: PailFastifyReply, done: () => void) => {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        const requestId = (request.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID();
        const safeHeaders = extractSafeNodeHeaders(request.headers);

        const { finish, logger, skipped } = createMiddlewareLogger(options, {
            headers: safeHeaders,
            method: request.method,
            path: request.url,
            requestId,
        });

        if (skipped) {
            done();

            return;
        }

        request.log = logger;
        requestState.set(request, { finish });

        loggerStorage.storage.run(logger, () => {
            done();
        });
    });

    // eslint-disable-next-line @typescript-eslint/require-await -- Fastify hook signature requires Promise<void>
    fastify.addHook("onResponse", async (request: PailFastifyRequest, reply: PailFastifyReply) => {
        const state = requestState.get(request);

        if (!state || emitted.has(request)) {
            return;
        }

        emitted.add(request);
        state.finish({ status: reply.statusCode });
    });

    // eslint-disable-next-line @typescript-eslint/require-await -- Fastify hook signature requires Promise<void>
    fastify.addHook("onError", async (request: PailFastifyRequest, _reply: PailFastifyReply, error: Error) => {
        const state = requestState.get(request);

        if (!state || emitted.has(request)) {
            return;
        }

        emitted.add(request);
        state.finish({ error });
    });
};

export { useLogger };
export type { FastifyPluginOptions, PailFastifyInstance, PailFastifyReply, PailFastifyRequest };
export type { WideEvent } from "../wide-event";
