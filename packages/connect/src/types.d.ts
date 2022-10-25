import { AnyZodObject } from "zod";

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

export type FunctionLike = (...arguments_: any[]) => unknown;

export type RouteMatch = string | RegExp;

export type NextHandler = () => ValueOrPromise<any>;

export type Nextable<H extends FunctionLike> = (...arguments_: [...Parameters<H>, NextHandler]) => ValueOrPromise<any>;

export type FindResult<H extends FunctionLike> = {
    fns: Nextable<H>[];
    params: Record<string, string>;
    middleOnly: boolean;
};

export type RoutesExtendedRequestHandler<Request extends object, Context extends unknown, RResponse extends unknown, Routes> = (
    request: Request,
    response: Context,
    routes: Routes,
) => ValueOrPromise<RResponse | void>;

export interface HandlerOptions<Handler extends FunctionLike> {
    onNoMatch?: Handler;
    onError?: (error: unknown, ...arguments_: Parameters<Handler>) => ReturnType<Handler>;
}

export type ValueOrPromise<T> = T | Promise<T>;

export type RouteShortcutMethod<This, Schema extends AnyZodObject, H extends FunctionLike> = (
    route: RouteMatch | Nextable<H>,
    zodSchemaOrRouteOrFns?: Schema | RouteMatch | Nextable<H> | string,
    ...fns: Nextable<H>[]
) => This;
