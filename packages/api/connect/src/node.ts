import type { IncomingMessage, ServerResponse } from "node:http";

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

const onNoMatch = (request: IncomingMessage, response: ServerResponse) => {
    response.statusCode = 404;
    response.end(request.method === "HEAD" ? undefined : `Route ${String(request.method)} ${String(request.url)} not found`);
};

const onError = (error: unknown, _request: IncomingMessage, response: ServerResponse) => {
    response.statusCode = 500;

    globalThis.console.error(error);

    response.end("Internal Server Error");
};

export const getPathname = (url: string): string => {
    const queryIndex = url.indexOf("?");

    return queryIndex === -1 ? url : url.slice(0, Math.max(0, queryIndex));
};

export type RequestHandler<Request extends IncomingMessage, Response extends ServerResponse> = (request: Request, response: Response) => ValueOrPromise<void>;

export class NodeRouter<
    Request extends IncomingMessage = IncomingMessage,
    Response extends ServerResponse = ServerResponse,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ZodObject requires `any` for generic parameter compatibility
    Schema extends z.ZodObject<any> = z.ZodObject<any>,
> {
    private static prepareRequest<Request extends IncomingMessage, Response extends ServerResponse>(
        request: Request & { params?: Record<string, unknown> },
        findResult: FindResult<RequestHandler<Request, Response>>,
    ): void {
        request.params = {
            ...findResult.params,
            ...request.params, // original params will take precedence
        };
    }

    public all: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "");

    public connect: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "CONNECT");

    public delete: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "DELETE");

    public get: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "GET");

    public head: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "HEAD");

    public options: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "OPTIONS");

    public patch: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "PATCH");

    public post: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "POST");

    public put: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "PUT");

    public trace: RouteShortcutMethod<this, Schema, RequestHandler<Request, Response>> = this.add.bind(this, "TRACE");

    private readonly onError: (
        error: unknown,
        ...arguments_: Parameters<RoutesExtendedRequestHandler<Request, Response, Response, Route<Nextable<FunctionLike>>[]>>
    ) => ReturnType<RoutesExtendedRequestHandler<Request, Response, Response, Route<Nextable<FunctionLike>>[]>>;

    private readonly onNoMatch: RoutesExtendedRequestHandler<Request, Response, Response, Route<Nextable<FunctionLike>>[]>;

    private router = new Router<RequestHandler<Request, Response>>();

    public constructor(options: HandlerOptions<RoutesExtendedRequestHandler<Request, Response, Response, Route<Nextable<FunctionLike>>[]>> = {}) {
        this.onNoMatch = options.onNoMatch ?? (onNoMatch as unknown as typeof this.onNoMatch);
        this.onError = options.onError ?? (onError as unknown as typeof this.onError);
    }

    public clone(): NodeRouter<Request, Response, Schema> {
        const r = new NodeRouter<Request, Response, Schema>({ onError: this.onError, onNoMatch: this.onNoMatch });

        r.router = this.router.clone();

        return r;
    }

    public handler(): (request: Request, response: Response) => Promise<void> {
        const { routes } = this.router as Router<FunctionLike>;

        return async (request: Request, response: Response) => {
            const pathname = getPathname(request.url as string);
            const method = request.method as HttpMethod;
            // unicorn rules false-positive: Router.find is not Array.prototype.find
            // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
            const result = this.router.find(method, pathname);

            NodeRouter.prepareRequest<Request, Response>(request, result);

            try {
                await (result.fns.length === 0 || result.middleOnly ? this.onNoMatch(request, response, routes) : Router.exec(result.fns, request, response));
            } catch (error) {
                await this.onError(error, request, response, routes);
            }
        };
    }

    public async run(request: Request, response: Response): Promise<unknown> {
        const pathname = getPathname(request.url as string);
        const method = request.method as HttpMethod;
        // unicorn rules false-positive: Router.find is not Array.prototype.find
        // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
        const result = this.router.find(method, pathname);

        if (result.fns.length === 0) {
            return undefined;
        }

        NodeRouter.prepareRequest<Request, Response>(request, result);

        return Router.exec(result.fns, request, response);
    }

    public use(
        base: Nextable<RequestHandler<Request, Response>> | NodeRouter<Request, Response, Schema> | RouteMatch,
        ...fns: (Nextable<RequestHandler<Request, Response>> | NodeRouter<Request, Response, Schema>)[]
    ): this {
        let resolvedBase: RouteMatch;

        if (typeof base === "function" || base instanceof NodeRouter) {
            fns.unshift(base);
            resolvedBase = "/";
        } else {
            resolvedBase = base;
        }

        this.router.use(
            resolvedBase,
            ...fns.map((function_) => {
                if (function_ instanceof NodeRouter) {
                    return function_.router;
                }

                return function_;
            }),
        );

        return this;
    }

    private add(
        method: HttpMethod | "",
        routeOrFunction: Nextable<RequestHandler<Request, Response>> | RouteMatch,
        zodOrRouteOrFunction?: Nextable<RequestHandler<Request, Response>> | RouteMatch | Schema,
        ...fns: Nextable<RequestHandler<Request, Response>>[]
    ) {
        let resolvedFns: Nextable<RequestHandler<Request, Response>>[];

        if (typeof routeOrFunction === "string" && typeof zodOrRouteOrFunction === "function") {
            resolvedFns = [zodOrRouteOrFunction];
        } else if (typeof zodOrRouteOrFunction === "object") {
            resolvedFns
                = typeof routeOrFunction === "function"
                    ? [withZod(zodOrRouteOrFunction as Schema, routeOrFunction)]
                    : fns.map((function_) => withZod(zodOrRouteOrFunction as Schema, function_));
        } else if (typeof zodOrRouteOrFunction === "function") {
            resolvedFns = [zodOrRouteOrFunction];
        } else {
            resolvedFns = fns;
        }

        this.router.add(method, routeOrFunction, ...resolvedFns);

        return this;
    }
}

export const createRouter = <
    Request extends IncomingMessage,
    Response extends ServerResponse,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ZodObject requires `any` for generic parameter compatibility
    Schema extends z.ZodObject<any> = z.ZodObject<any>,
>(
    options: HandlerOptions<RoutesExtendedRequestHandler<Request, Response, Response, Route<Nextable<FunctionLike>>[]>> = {},
): NodeRouter<Request, Response, Schema> => new NodeRouter<Request, Response, Schema>(options);
