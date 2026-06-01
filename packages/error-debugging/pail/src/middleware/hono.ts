import type { WideEvent } from "../wide-event";
import type { PailMiddlewareOptions } from "./shared/create-middleware-logger";
import { createMiddlewareLogger } from "./shared/create-middleware-logger";
import { extractSafeHeaders } from "./shared/headers";

/**
 * A Hono-like context object with access to the pail logger.
 *
 * Use `c.get("log")` or `useLogger(c)` to access the WideEvent logger.
 * @example
 * ```typescript
 * import type { PailHonoContext } from "@visulima/pail/middleware/hono";
 *
 * app.get("/api/users", (c: PailHonoContext) => {
 *   const log = c.get("log");
 *   log.set({ user: { id: 1 } });
 * });
 * ```
 */
interface PailHonoContext {
    [key: string]: unknown;
    get: (key: string) => unknown;
    req: {
        header: (name: string) => string | undefined;
        method: string;
        path: string;
        raw: { headers: Headers };
    };
    res: { status: number };
    set: (key: string, value: unknown) => void;
}

/**
 * Hono-compatible next function.
 */
type PailHonoNext = () => Promise<void>;

/**
 * The Hono middleware function signature returned by `pailMiddleware()`.
 */
type PailHonoMiddleware = (c: PailHonoContext, next: PailHonoNext) => Promise<void>;

/**
 * Configuration options for the Hono pail middleware.
 * @template T - Custom logger type names from the pail instance
 */
type HonoMiddlewareOptions<T extends string = string> = PailMiddlewareOptions<T>;

/**
 * Retrieve the WideEvent logger from Hono context.
 * Must be called within a request handler where pail middleware is active.
 * @param c The Hono context object
 * @returns The request-scoped WideEvent logger
 * @throws Error if the middleware is not registered
 */
const useLogger = (c: PailHonoContext): WideEvent => {
    const logger = c.get("log") as WideEvent | undefined;

    if (!logger) {
        throw new Error("[pail] useLogger() called but pail middleware is not registered.");
    }

    return logger;
};

/**
 * Create Hono middleware that attaches a WideEvent logger to each request.
 *
 * The logger is available via:
 * - `c.get("log")` on the Hono context
 * - `useLogger(c)` helper function
 *
 * The wide event is automatically emitted when the handler completes or throws.
 * @param options Middleware configuration
 * @returns Hono middleware function
 * @example
 * ```typescript
 * import { Hono } from "hono";
 * import { createPail } from "@visulima/pail";
 * import { pailMiddleware, useLogger } from "@visulima/pail/middleware/hono";
 *
 * const app = new Hono();
 * const logger = createPail();
 *
 * app.use("*", pailMiddleware({ pail: logger }));
 *
 * app.get("/api/users", (c) => {
 *   const log = useLogger(c);
 *   log.set({ user: { id: 1 } });
 *   return c.json({ ok: true });
 * });
 * ```
 */
export const pailMiddleware =
    <T extends string = string>(options: HonoMiddlewareOptions<T>): PailHonoMiddleware =>
    async (c: PailHonoContext, next: PailHonoNext): Promise<void> => {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
        const safeHeaders = extractSafeHeaders(c.req.raw.headers);

        const { finish, logger, skipped } = createMiddlewareLogger(options, {
            headers: safeHeaders,
            method: c.req.method,
            path: c.req.path,
            requestId,
        });

        if (skipped) {
            await next();

            return;
        }

        c.set("log", logger);

        try {
            await next();
            finish({ status: c.res.status });
        } catch (error) {
            finish({ error: error instanceof Error ? error : new Error(String(error)) });
            throw error;
        }
    };

export { useLogger };
export type { HonoMiddlewareOptions, PailHonoContext, PailHonoMiddleware, PailHonoNext };
export type { WideEvent } from "../wide-event";
