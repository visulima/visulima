// eslint-disable-next-line import/no-namespace
import type * as z from "zod";

export type HttpMethod = "CONNECT" | "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionLike = (...arguments_: any[]) => any;

export type RouteMatch = RegExp | string;

export type ValueOrPromise<T> = Promise<T> | T;

export type NextHandler = () => ValueOrPromise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Nextable<H extends FunctionLike> = (...arguments_: [...Parameters<H>, NextHandler]) => ValueOrPromise<any>;

export interface FindResult<H extends FunctionLike> {
    fns: Nextable<H>[];
    middleOnly: boolean;
    params: Record<string, string>;
}

export type RoutesExtendedRequestHandler<Request extends object, Context, RResponse, Routes> = (
    request: Request,
    response: Context,
    routes: Routes,
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) => ValueOrPromise<RResponse | void>;

export interface HandlerOptions<Handler extends FunctionLike> {
    onError?: (error: unknown, ...arguments_: Parameters<Handler>) => ReturnType<Handler>;
    onNoMatch?: Handler;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteShortcutMethod<This, Schema extends z.ZodObject<any>, H extends FunctionLike> = (
    route: Nextable<H> | RouteMatch,
    zodSchemaOrRouteOrFns?: Nextable<H> | RouteMatch | Schema | string,
    ...fns: Nextable<H>[]
) => This;
