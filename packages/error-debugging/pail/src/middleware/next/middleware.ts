/**
 * Minimal type definitions to avoid requiring next as a dependency.
 */
interface NextRequest {
    headers: Headers;
    nextUrl: { pathname: string };
}

interface NextResponse {
    headers: Headers;
}

interface NextResponseConstructor {
    next: (options?: { request?: { headers?: Headers } }) => NextResponse;
}

const GLOB_STRIP_RE = /\*+/g;

/**
 * Options for the Next.js pail middleware.
 */
interface PailNextMiddlewareOptions {
    /**
     * Glob patterns for paths to exclude from logging.
     * Excluded paths won't get request IDs or timing headers.
     * @example ["/_next/**", "/favicon.ico"]
     */
    exclude?: string[];

    /**
     * Glob patterns for paths to include in logging.
     * If not set, all non-excluded paths are included.
     */
    include?: string[];
}

/**
 * Create a Next.js edge middleware that sets `x-request-id` and `x-pail-start`
 * headers on the request for downstream use by `withPail()`.
 *
 * This middleware runs at the edge and prepares request metadata.
 * The actual wide event logging happens in `withPail()`.
 * @param NextResponseClass The NextResponse class from "next/server"
 * @param options Middleware configuration
 * @returns A middleware function
 * @example
 * ```typescript
 * // middleware.ts
 * import { NextResponse } from "next/server";
 * import { pailMiddleware } from "@visulima/pail/middleware/next";
 *
 * const middleware = pailMiddleware(NextResponse, {
 *   exclude: ["/_next/**", "/favicon.ico"],
 * });
 *
 * export default middleware;
 * ```
 */
export const pailMiddleware = (NextResponseClass: NextResponseConstructor, options?: PailNextMiddlewareOptions): ((request: NextRequest) => NextResponse) => {
    const { exclude, include } = options ?? {};

    return (request: NextRequest): NextResponse => {
        const path = request.nextUrl.pathname;

        // Simple check — full shouldLog is in the handler
        if (exclude?.some((p) => path.startsWith(p.replaceAll(GLOB_STRIP_RE, "")))) {
            return NextResponseClass.next();
        }

        if (include?.length && !include.some((p) => path.startsWith(p.replaceAll(GLOB_STRIP_RE, "")))) {
            return NextResponseClass.next();
        }

        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
        const requestHeaders = new Headers(request.headers);

        requestHeaders.set("x-request-id", requestId);
        requestHeaders.set("x-pail-start", String(Date.now()));

        const response = NextResponseClass.next({
            request: { headers: requestHeaders },
        });

        response.headers.set("x-request-id", requestId);

        return response;
    };
};

export type { PailNextMiddlewareOptions };
