// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires namespace imports
import type * as z from "zod";

import withZod from "./adapter/with-zod";
import type { Route } from "./router";
import { Router } from "./router";
import type {
    FindResult,
    FunctionLike,
    HandlerOptions,
    HttpMethod,
    Nextable,
    RouteMatch,
    RoutesExtendedRequestHandler,
    RouteShortcutMethod,
    ValueOrPromise,
} from "./types";

const onNoMatch = (request: Request) =>
    new Response(request.method === "HEAD" ? undefined : `Route ${request.method} ${request.url} not found`, { status: 404 });

const onError = (error: unknown) => {
    globalThis.console.error(error);

    return new Response("Internal Server Error", { status: 500 });
};

export const getPathname = (request: Request & { nextUrl?: URL }): string => {
    if (request.nextUrl !== undefined) {
        return request.nextUrl.pathname;
    }

    // Scan the absolute request URL for the pathname instead of allocating a full `URL` parser
    // on every request. `request.url` for a Fetch `Request` is always absolute (e.g.
    // `https://host/path?query`), so locate the start of the path after the `://` authority.
    const { url } = request;
    const schemeIndex = url.indexOf("://");

    if (schemeIndex === -1) {
        // Fallback for relative or otherwise non-standard URLs. The base host is only a dummy used to
        // satisfy the URL parser; it never reaches the network.
        // eslint-disable-next-line sonarjs/no-clear-text-protocols -- dummy base for relative-URL parsing only, no network use
        return new URL(url, "http://n").pathname;
    }

    const pathStart = url.indexOf("/", schemeIndex + 3);

    if (pathStart === -1) {
        return "/";
    }

    const queryIndex = url.indexOf("?", pathStart);
    const hashIndex = url.indexOf("#", pathStart);

    let end = url.length;

    if (queryIndex !== -1) {
        end = Math.min(end, queryIndex);
    }

    if (hashIndex !== -1) {
        end = Math.min(end, hashIndex);
    }

    return url.slice(pathStart, end);
};

export type RequestHandler<R extends Request, Context> = (request: R, context_: Context) => ValueOrPromise<Response | undefined>;

export class EdgeRouter<
    R extends Request = Request,
    Context = unknown,
    RResponse extends Response = Response,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Schema extends z.ZodObject<any> = z.ZodObject<any>,
> {
    private static prepareRequest<R extends Request, Context>(
        request: R & { params?: Record<string, unknown> },
        findResult: FindResult<RequestHandler<R, Context>>,
    ): void {
        request.params = {
            ...findResult.params,
            ...request.params, // original params will take precedence
        };
    }

    public all: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "");

    public connect: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "CONNECT");

    public delete: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "DELETE");

    public get: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "GET");

    public head: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "HEAD");

    public options: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "OPTIONS");

    public patch: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "PATCH");

    public post: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "POST");

    public put: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "PUT");

    public trace: RouteShortcutMethod<this, Schema, RequestHandler<R, Context>> = this.add.bind(this, "TRACE");

    private readonly onError: (
        error: unknown,
        ...arguments_: Parameters<RoutesExtendedRequestHandler<R, Context, RResponse, Route<Nextable<FunctionLike>>[]>>
    ) => ReturnType<RoutesExtendedRequestHandler<R, Context, RResponse, Route<Nextable<FunctionLike>>[]>>;

    private readonly onNoMatch: RoutesExtendedRequestHandler<R, Context, RResponse, Route<Nextable<FunctionLike>>[]>;

    private router = new Router<RequestHandler<R, Context>>();

    public constructor(options: HandlerOptions<RoutesExtendedRequestHandler<R, Context, RResponse, Route<Nextable<FunctionLike>>[]>> = {}) {
        this.onNoMatch = options.onNoMatch ?? (onNoMatch as unknown as RoutesExtendedRequestHandler<R, Context, RResponse, Route<Nextable<FunctionLike>>[]>);
        this.onError
            = options.onError
                ?? (onError as unknown as (
                    error: unknown,
                    ...arguments_: Parameters<RoutesExtendedRequestHandler<R, Context, RResponse, Route<Nextable<FunctionLike>>[]>>
                ) => ReturnType<RoutesExtendedRequestHandler<R, Context, RResponse, Route<Nextable<FunctionLike>>[]>>);
    }

    public clone(): EdgeRouter<R, Context, RResponse, Schema> {
        const r = new EdgeRouter<R, Context, RResponse, Schema>({ onError: this.onError, onNoMatch: this.onNoMatch });

        r.router = this.router.clone();

        return r;
    }

    public handler(): (request: R, context_: Context) => Promise<RResponse | undefined> {
        const { routes } = this.router as Router<FunctionLike>;

        return async (request: R, context_: Context): Promise<RResponse | undefined> => {
            const pathname = getPathname(request);
            const method = request.method as HttpMethod;
            // unicorn rules false-positive: Router.find is not Array.prototype.find
            // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
            const result = this.router.find(method, pathname);

            EdgeRouter.prepareRequest<R, Context>(request, result);

            try {
                return (await (result.fns.length === 0 || result.middleOnly
                    ? this.onNoMatch(request, context_, routes)
                    : Router.exec(result.fns, request, context_))) as RResponse | undefined;
            } catch (error) {
                return await this.onError(error, request, context_, routes);
            }
        };
    }

    public async run(request: R, context_: Context): Promise<unknown> {
        const pathname = getPathname(request);
        const method = request.method as HttpMethod;
        // unicorn rules false-positive: Router.find is not Array.prototype.find
        // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
        const result = this.router.find(method, pathname);

        if (result.fns.length === 0) {
            return undefined;
        }

        EdgeRouter.prepareRequest<R, Context>(request, result);

        return Router.exec(result.fns, request, context_);
    }

    public use(
        base: EdgeRouter<R, Context> | Nextable<RequestHandler<R, Context>> | RouteMatch,
        ...fns: (EdgeRouter<R, Context> | Nextable<RequestHandler<R, Context>>)[]
    ): this {
        let resolvedBase: RouteMatch;

        if (typeof base === "function" || base instanceof EdgeRouter) {
            fns.unshift(base as EdgeRouter<R, Context>);
            resolvedBase = "/";
        } else {
            resolvedBase = base;
        }

        this.router.use(
            resolvedBase,
            ...fns.map((function_) => {
                if (function_ instanceof EdgeRouter) {
                    return function_.router;
                }

                return function_;
            }),
        );

        return this;
    }

    private add(
        method: HttpMethod | "",
        routeOrFunction: Nextable<RequestHandler<R, Context>> | RouteMatch,
        zodOrRouteOrFunction?: Nextable<RequestHandler<R, Context>> | RouteMatch | Schema,
        ...fns: Nextable<RequestHandler<R, Context>>[]
    ) {
        let resolvedFns: Nextable<RequestHandler<R, Context>>[];

        if (typeof routeOrFunction === "string" && typeof zodOrRouteOrFunction === "function") {
            // `.get("/path", handlerA, handlerB, ...)` — keep every handler in the chain.
            resolvedFns = [zodOrRouteOrFunction, ...fns];
        } else if (typeof zodOrRouteOrFunction === "object") {
            resolvedFns
                = typeof routeOrFunction === "function"
                    ? [withZod(zodOrRouteOrFunction as Schema, routeOrFunction)]
                    : fns.map((function_) => withZod(zodOrRouteOrFunction as Schema, function_));
        } else if (typeof zodOrRouteOrFunction === "function") {
            // `.get(handlerA, handlerB, ...)` (no route) — keep every handler in the chain.
            resolvedFns = [zodOrRouteOrFunction, ...fns];
        } else {
            resolvedFns = fns;
        }

        this.router.add(method, routeOrFunction, ...resolvedFns);

        return this;
    }
}

export const createEdgeRouter = <R extends Request, Context>(
    options: HandlerOptions<RoutesExtendedRequestHandler<R, Context, Response, Route<Nextable<FunctionLike>>[]>> = {},
): EdgeRouter<R, Context> => new EdgeRouter<R, Context>(options);
