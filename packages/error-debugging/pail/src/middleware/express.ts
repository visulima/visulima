import type { WideEvent } from "../wide-event";
import type { PailMiddlewareOptions } from "./shared/create-middleware-logger";
import { createMiddlewareLogger } from "./shared/create-middleware-logger";
import { extractSafeNodeHeaders } from "./shared/headers";
import { createLoggerStorage } from "./shared/storage";

/**
 * An Express-like request object with the pail logger attached.
 * Use this to type your route handlers when accessing `req.log`.
 * @example
 * ```typescript
 * import type { PailRequest } from "@visulima/pail/middleware/express";
 *
 * app.get("/api/users", (req: PailRequest, res) => {
 *   req.log?.set({ user: { id: 1 } });
 * });
 * ```
 */
interface PailRequest {
    [key: string]: unknown;
    headers: Record<string, string | string[] | undefined>;

    /**
     * The request-scoped WideEvent logger, attached by pail middleware.
     * Only present for non-excluded routes.
     */
    log?: WideEvent;
    method: string;
    originalUrl?: string;
    path: string;
}

/**
 * An Express-like response object.
 */
interface PailResponse {
    [key: string]: unknown;
    on: (event: string, listener: () => void) => void;
    statusCode: number;
}

/**
 * Express-compatible next function.
 */
type PailNextFunction = (error?: unknown) => void;

/**
 * The Express middleware function signature returned by `pailMiddleware()`.
 */
type PailExpressMiddleware = (request: PailRequest, response: PailResponse, next: PailNextFunction) => void;

const loggerStorage = createLoggerStorage("Express middleware context. Make sure pail middleware is registered before your route handlers.");

/**
 * Retrieve the request-scoped WideEvent logger from AsyncLocalStorage.
 * Must be called within a request handled by the pail Express middleware.
 * @returns The request-scoped WideEvent logger
 * @throws Error if called outside of the middleware context
 */
const useLogger = (): WideEvent => loggerStorage.useLogger();

/**
 * Configuration options for the Express pail middleware.
 * @template T - Custom logger type names from the pail instance
 */
type ExpressMiddlewareOptions<T extends string = string> = PailMiddlewareOptions<T>;

/**
 * Create Express middleware that attaches a WideEvent logger to each request.
 *
 * The logger is available via:
 * - `req.log` on the request object
 * - `useLogger()` from anywhere in the async call stack
 *
 * The wide event is automatically emitted when the response finishes.
 * @param options Middleware configuration
 * @returns Express middleware function
 * @example
 * ```typescript
 * import express from "express";
 * import { createPail } from "@visulima/pail";
 * import { pailMiddleware, useLogger } from "@visulima/pail/middleware/express";
 *
 * const app = express();
 * const logger = createPail();
 *
 * app.use(pailMiddleware({ pail: logger }));
 *
 * app.get("/api/users", (req, res) => {
 *   req.log.set({ user: { id: 1 } });
 *   // or: useLogger().set({ user: { id: 1 } });
 *   res.json({ ok: true });
 * });
 * ```
 */
export const pailMiddleware
    = <T extends string = string>(options: ExpressMiddlewareOptions<T>): PailExpressMiddleware =>
        (request: PailRequest, response: PailResponse, next: PailNextFunction): void => {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
            const requestId = (request.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID();
            const path: string = request.originalUrl ?? (request.url as string | undefined) ?? "/";
            const safeHeaders = extractSafeNodeHeaders(request.headers);

            const { finish, logger, skipped } = createMiddlewareLogger(options, {
                headers: safeHeaders,
                method: request.method,
                path,
                requestId,
            });

            if (skipped) {
                next();

                return;
            }

            request.log = logger;

            response.on("finish", () => {
                finish({ status: response.statusCode });
            });

            loggerStorage.storage.run(logger, () => {
                next();
            });
        };

export { useLogger };
export type { ExpressMiddlewareOptions, PailExpressMiddleware, PailNextFunction, PailRequest, PailResponse };
export type { WideEvent } from "../wide-event";
