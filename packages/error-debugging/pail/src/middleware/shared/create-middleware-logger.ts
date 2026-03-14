import type { PailBrowserImpl } from "../../pail.browser";
import type { DefaultLogTypes, LoggerFunction } from "../../types";
import type { WideEventFinishOptions } from "../../wide-event";
import { WideEvent } from "../../wide-event";
import type { RouteConfig } from "./routes";
import { getServiceForPath, shouldLog } from "./routes";

/**
 * A pail instance with dynamically generated log methods.
 */
type PailLike<T extends string = string> = PailBrowserImpl<T> & Record<DefaultLogTypes | T, LoggerFunction>;

/**
 * Base options shared by all framework middleware adapters.
 * @template T - Custom logger type names from the pail instance
 */
export interface PailMiddlewareOptions<T extends string = string> {
    /**
     * Glob patterns for paths to exclude from logging.
     * Exclusions take precedence over inclusions.
     * @example ["/health", "/api/_internal/**"]
     */
    exclude?: string[];

    /**
     * Glob patterns for paths to include in logging.
     * If not set, all non-excluded paths are logged.
     * @example ["/api/**"]
     */
    include?: string[];

    /**
     * The pail logger instance to use for wide event emission.
     */
    pail: PailLike<T>;

    /**
     * Route-specific configuration. Maps glob patterns to config.
     * First matching route wins.
     * @example { "/api/auth/**": { service: "auth-service" } }
     */
    routes?: Record<string, RouteConfig>;

    /**
     * Default service name for all wide events.
     * Can be overridden per-route via `routes`.
     */
    service?: string;
}

/**
 * Result of creating a middleware logger for a request.
 */
export interface MiddlewareLoggerResult {
    /**
     * Finalize and emit the wide event. Sets status/error before emitting.
     * Safe to call multiple times — only the first call emits.
     */
    finish: (options?: WideEventFinishOptions) => void;

    /**
     * The request-scoped WideEvent logger.
     * Use `set()`, `info()`, `warn()`, `error()`, `debug()` to accumulate context.
     */
    logger: WideEvent;

    /**
     * Whether this request was skipped (excluded from logging).
     * When true, `logger` and `finish` should not be used.
     */
    skipped: boolean;
}

/**
 * Core factory function used by all framework middleware adapters.
 *
 * Creates a WideEvent for the given request, checks route inclusion/exclusion,
 * resolves the service name, and returns a logger + finish callback.
 * @param options Middleware options including pail instance and route config
 * @param request Request metadata for the current HTTP request
 * @param request.headers Safe headers extracted from the request
 * @param request.method The HTTP method (GET, POST, etc.)
 * @param request.path The URL path of the request
 * @param request.requestId A unique identifier for this request
 * @returns A result object with logger, finish callback, and skipped flag
 */
export const createMiddlewareLogger = <T extends string = string>(
    options: PailMiddlewareOptions<T>,
    request: {
        headers?: Record<string, string>;
        method: string;
        path: string;
        requestId: string;
    },
): MiddlewareLoggerResult => {
    const { exclude, include, pail, routes, service } = options;
    const { headers, method, path, requestId } = request;

    if (!shouldLog(path, include, exclude)) {
        // Return a no-op logger that won't emit anything
        const noopLogger = new WideEvent({ autoEmit: false, name: `${method} ${path}`, pail: pail as PailLike });

        return {
            finish: () => {},
            logger: noopLogger,
            skipped: true,
        };
    }

    const routeService = getServiceForPath(path, routes) ?? service;

    const logger = new WideEvent({
        name: `${method} ${path}`,
        pail: pail as PailLike,
        service: routeService,
    });

    logger.set({
        method,
        path,
        requestId,
        ...headers ? { headers } : {},
    } as Record<string, unknown>);

    const finish = (finishOptions?: WideEventFinishOptions): void => {
        logger.finish(finishOptions);
    };

    return {
        finish,
        logger,
        skipped: false,
    };
};
