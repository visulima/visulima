import type { AnyZodObject } from "zod";

export type HttpMethod = "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT";

export type FunctionLike = (...arguments_: any[]) => unknown;

export type RouteMatch = RegExp | string;

export type NextHandler = () => ValueOrPromise<any>;

export type Nextable<H extends FunctionLike> = (...arguments_: [...Parameters<H>, NextHandler]) => ValueOrPromise<any>;

export type FindResult<H extends FunctionLike> = {
    fns: Nextable<H>[];
    params: Record<string, string>;
    middleOnly: boolean;
};

export type RoutesExtendedRequestHandler<Request extends object, Context, RResponse, Routes> = (
    request: Request,
    response: Context,
    routes: Routes,
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) => ValueOrPromise<RResponse | void>;

export interface HandlerOptions<Handler extends FunctionLike> {
    onNoMatch?: Handler;
    onError?: (error: unknown, ...arguments_: Parameters<Handler>) => ReturnType<Handler>;
}

export type ValueOrPromise<T> = Promise<T> | T;

export type RouteShortcutMethod<This, Schema extends AnyZodObject, H extends FunctionLike> = (
    route: Nextable<H> | RouteMatch,
    zodSchemaOrRouteOrFns?: Nextable<H> | RouteMatch | Schema | string,
    ...fns: Nextable<H>[]
) => This;
