import type { ZodObject } from "zod";

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

const onNoMatch = async (request: Request) =>
    new Response(request.method === "HEAD" ? null : `Route ${request.method} ${request.url} not found`, { status: 404 });

const onError = async (error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);

    return new Response("Internal Server Error", { status: 500 });
};

export const getPathname = (request: Request & { nextUrl?: URL }): string =>
    // eslint-disable-next-line compat/compat
    (request.nextUrl ?? new URL(request.url)).pathname;

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type RequestHandler<R extends Request, Context> = (request: R, context_: Context) => ValueOrPromise<Response | void>;

export class EdgeRouter<R extends Request = Request, Context = unknown, RResponse extends Response = Response, Schema extends ZodObject<any> = ZodObject<any>> {
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

    public handler(): (request: R, context_: Context) => Promise<any> | ReturnType<FunctionLike> | ValueOrPromise<RResponse> {
        const { routes } = this.router as Router<FunctionLike>;

        return async (request: R, context_: Context): Promise<any> => {
            // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-method-this-argument
            const result = this.router.find(request.method as HttpMethod, getPathname(request));

            this.prepareRequest(request, result);

            try {
                return await (result.fns.length === 0 || result.middleOnly
                    ? this.onNoMatch(request, context_, routes)
                    : Router.exec(result.fns, request, context_));
            } catch (error) {
                return await this.onError(error, request, context_, routes);
            }
        };
    }

    public async run(request: R, context_: Context): Promise<unknown> {
        // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-method-this-argument
        const result = this.router.find(request.method as HttpMethod, getPathname(request));

        if (result.fns.length === 0) {
            return;
        }

        this.prepareRequest(request, result);

        // eslint-disable-next-line consistent-return
        return await Router.exec(result.fns, request, context_);
    }

    public use(
        base: EdgeRouter<R, Context> | Nextable<RequestHandler<R, Context>> | RouteMatch,
        ...fns: (EdgeRouter<R, Context> | Nextable<RequestHandler<R, Context>>)[]
    ): this {
        if (typeof base === "function" || base instanceof EdgeRouter) {
            fns.unshift(base as EdgeRouter<R, Context>);
            // eslint-disable-next-line no-param-reassign
            base = "/";
        }

        this.router.use(base, ...fns.map((function_) => function_ instanceof EdgeRouter ? function_.router : function_));

        return this;
    }

    private add(
        method: HttpMethod | "",
        routeOrFunction: Nextable<RequestHandler<R, Context>> | RouteMatch,
        zodOrRouteOrFunction?: Nextable<RequestHandler<R, Context>> | RouteMatch | Schema,
        ...fns: Nextable<RequestHandler<R, Context>>[]
    ) {
        if (typeof routeOrFunction === "string" && typeof zodOrRouteOrFunction === "function") {
            // eslint-disable-next-line no-param-reassign
            fns = [zodOrRouteOrFunction];
        } else if (typeof zodOrRouteOrFunction === "object") {
            // eslint-disable-next-line unicorn/prefer-ternary
            if (typeof routeOrFunction === "function") {
                // eslint-disable-next-line no-param-reassign
                fns = [withZod<R, Context, Nextable<RequestHandler<R, Context>>, Schema>(zodOrRouteOrFunction as Schema, routeOrFunction)];
            } else {
                // eslint-disable-next-line no-param-reassign
                fns = fns.map((function_) => withZod<R, Context, Nextable<RequestHandler<R, Context>>, Schema>(zodOrRouteOrFunction as Schema, function_));
            }
        } else if (typeof zodOrRouteOrFunction === "function") {
            // eslint-disable-next-line no-param-reassign
            fns = [zodOrRouteOrFunction];
        }

        this.router.add(method, routeOrFunction, ...fns);

        return this;
    }

    // eslint-disable-next-line class-methods-use-this
    private prepareRequest(request: R & { params?: Record<string, unknown> }, findResult: FindResult<RequestHandler<R, Context>>) {
        request.params = {
            ...findResult.params,
            ...request.params, // original params will take precedence
        };
    }
}

export const createEdgeRouter = <R extends Request, Context>(
    options: HandlerOptions<RoutesExtendedRequestHandler<R, Context, Response, Route<Nextable<FunctionLike>>[]>> = {},
): EdgeRouter<R, Context> => new EdgeRouter<R, Context, Response>(options);
