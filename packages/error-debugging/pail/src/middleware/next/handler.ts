import type { PailMiddlewareOptions } from "../shared/create-middleware-logger";
import { createMiddlewareLogger } from "../shared/create-middleware-logger";
import { extractSafeHeaders } from "../shared/headers";
import { pailStorage } from "./storage";

type NextPailOptions<T extends string = string> = PailMiddlewareOptions<T>;

/**
 * Create a `withPail` wrapper function for Next.js route handlers and server actions.
 *
 * Wraps handler execution in AsyncLocalStorage so that `useLogger()` works
 * anywhere in the async call stack. The wide event is automatically emitted
 * when the handler completes or throws.
 * @param options Configuration options
 * @returns A `withPail` wrapper function
 * @example
 * ```typescript
 * // lib/pail.ts
 * import { createPail } from "@visulima/pail";
 * import { createWithPail } from "@visulima/pail/middleware/next";
 *
 * const logger = createPail();
 * export const withPail = createWithPail({ pail: logger });
 *
 * // app/api/users/route.ts
 * import { withPail } from "@/lib/pail";
 * import { useLogger } from "@visulima/pail/middleware/next";
 *
 * export const GET = withPail(async (request: Request) => {
 *   const log = useLogger();
 *   log.set({ user: { id: 1 } });
 *   return Response.json({ ok: true });
 * });
 * ```
 */
export const createWithPail =
    <T extends string = string>(options: NextPailOptions<T>) =>
    /**
     * Wrap a Next.js route handler or server action with wide event logging.
     * @returns A wrapped handler that creates and emits a WideEvent
     */
    <TArgs extends unknown[], TReturn>(handler: (...args: TArgs) => Promise<TReturn> | TReturn): ((...args: TArgs) => Promise<TReturn>) =>
    async (...args: TArgs): Promise<TReturn> => {
        const [firstArgument] = args;
        const isRequest = firstArgument instanceof Request;

        let method = "UNKNOWN";
        let path = "/";
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        let requestId: string = crypto.randomUUID();
        let headers: Record<string, string> = {};

        if (isRequest) {
            const request = firstArgument;
            const url = new URL(request.url);

            method = request.method;
            path = url.pathname;
            headers = extractSafeHeaders(request.headers);

            // Reuse request ID from middleware if present
            const middlewareRequestId = request.headers.get("x-request-id");

            if (middlewareRequestId) {
                requestId = middlewareRequestId;
            }
        }

        const { finish, logger, skipped } = createMiddlewareLogger(options, {
            headers,
            method,
            path,
            requestId,
        });

        if (skipped) {
            return handler(...args);
        }

        try {
            const result = await pailStorage.run(logger, () => handler(...args));
            const status = result instanceof Response ? result.status : 200;

            finish({ status });

            return result;
        } catch (error) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            const errorStatus =
                (errorInstance as Error & { status?: number; statusCode?: number }).status ??
                (errorInstance as Error & { statusCode?: number }).statusCode ??
                500;

            finish({ error: errorInstance });
            logger.setStatus(errorStatus);

            throw error;
        }
    };

export type { NextPailOptions };
export type { WideEvent } from "../../wide-event";
export type { PailNextMiddlewareOptions } from "./middleware";
export { pailMiddleware } from "./middleware";
export { useLogger } from "./storage";
