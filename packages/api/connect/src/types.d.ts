// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires namespace imports
import type * as z from "zod";

export type HttpMethod = "CONNECT" | "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- base function type requires `any` for variance compatibility
export type FunctionLike = (...arguments_: any[]) => any;

export type RouteMatch = RegExp | string;

export type ValueOrPromise<T> = Promise<T> | T;

export type NextHandler = () => ValueOrPromise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- must return `any` to match arbitrary handler signatures
export type Nextable<H extends FunctionLike> = (...arguments_: [...Parameters<H>, NextHandler]) => ValueOrPromise<any>;

export interface FindResult<H extends FunctionLike> {
    /**
     * HTTP methods registered for the matched path under a *different* method than the one requested.
     * Only present (and non-empty) when the path exists but no route matched the requested method,
     * i.e. a 405 Method Not Allowed situation. Use it to populate the `Allow` header.
     */
    allowedMethods?: HttpMethod[];
    fns: Nextable<H>[];
    middleOnly: boolean;
    params: Record<string, string>;
}

export type RoutesExtendedRequestHandler<Request extends object, Context, RResponse, Routes> = (
    request: Request,
    response: Context,
    routes: Routes,
) => ValueOrPromise<RResponse | undefined>;

export interface HandlerOptions<Handler extends FunctionLike> {
    onError?: (error: unknown, ...arguments_: Parameters<Handler>) => ReturnType<Handler>;
    onNoMatch?: Handler;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ZodObject requires `any` for generic parameter compatibility
export type RouteShortcutMethod<This, Schema extends z.ZodObject<any>, H extends FunctionLike> = (
    route: Nextable<H> | RouteMatch,
    zodSchemaOrRouteOrFns?: Nextable<H> | RouteMatch | Schema | string,
    ...fns: Nextable<H>[]
) => This;
