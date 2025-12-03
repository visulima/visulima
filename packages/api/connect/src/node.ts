import type { IncomingMessage, ServerResponse } from "node:http";

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

const onNoMatch = async (request: IncomingMessage, response: ServerResponse) => {
    response.statusCode = 404;
    response.end(request.method === "HEAD" ? undefined : `Route ${request.method} ${request.url} not found`);
};

const onError = async (error: unknown, _request: IncomingMessage, response: ServerResponse) => {
    response.statusCode = 500;

    // eslint-disable-next-line no-console
    console.error(error);

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
    Schema extends ZodObject<any> = ZodObject<never>,
> {
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
        this.onNoMatch = options.onNoMatch ?? onNoMatch;
        this.onError = options.onError ?? onError;
    }

    public clone(): NodeRouter<Request, Response, Schema> {
        const r = new NodeRouter<Request, Response, Schema>({ onError: this.onError, onNoMatch: this.onNoMatch });

        r.router = this.router.clone();

        return r;
    }

    public handler(): (request: Request, response: Response) => Promise<void> {
        const { routes } = this.router as Router<FunctionLike>;

        return async (request: Request, response: Response) => {
            // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-method-this-argument
            const result = this.router.find(request.method as HttpMethod, getPathname(request.url as string));

            this.prepareRequest(request, result);

            try {
                await (result.fns.length === 0 || result.middleOnly ? this.onNoMatch(request, response, routes) : Router.exec(result.fns, request, response));
            } catch (error) {
                await this.onError(error, request, response, routes);
            }
        };
    }

    public async run(request: Request, response: Response): Promise<unknown> {
        // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-method-this-argument
        const result = this.router.find(request.method as HttpMethod, getPathname(request.url as string));

        if (result.fns.length === 0) {
            return;
        }

        this.prepareRequest(request, result);

        // eslint-disable-next-line consistent-return
        return await Router.exec(result.fns, request, response);
    }

    public use(
        base: Nextable<RequestHandler<Request, Response>> | NodeRouter<Request, Response, Schema> | RouteMatch,
        ...fns: (Nextable<RequestHandler<Request, Response>> | NodeRouter<Request, Response, Schema>)[]
    ): this {
        if (typeof base === "function" || base instanceof NodeRouter) {
            fns.unshift(base);
            // eslint-disable-next-line no-param-reassign
            base = "/";
        }

        this.router.use(base, ...fns.map((function_) => (function_ instanceof NodeRouter ? function_.router : function_)));

        return this;
    }

    private add(
        method: HttpMethod | "",
        routeOrFunction: Nextable<RequestHandler<Request, Response>> | RouteMatch,
        zodOrRouteOrFunction?: Nextable<RequestHandler<Request, Response>> | RouteMatch | Schema,
        ...fns: Nextable<RequestHandler<Request, Response>>[]
    ) {
        if (typeof routeOrFunction === "string" && typeof zodOrRouteOrFunction === "function") {
            // eslint-disable-next-line no-param-reassign
            fns = [zodOrRouteOrFunction];
        } else if (typeof zodOrRouteOrFunction === "object") {
            if (typeof routeOrFunction === "function") {
                // eslint-disable-next-line no-param-reassign
                fns = [withZod<Request, Response, Nextable<RequestHandler<Request, Response>>, Schema>(zodOrRouteOrFunction as Schema, routeOrFunction)];
            } else {
                // eslint-disable-next-line no-param-reassign
                fns = fns.map((function_) =>
                    withZod<Request, Response, Nextable<RequestHandler<Request, Response>>, Schema>(zodOrRouteOrFunction as Schema, function_),
                );
            }
        } else if (typeof zodOrRouteOrFunction === "function") {
            // eslint-disable-next-line no-param-reassign
            fns = [zodOrRouteOrFunction];
        }

        this.router.add(method, routeOrFunction, ...fns);

        return this;
    }

    // eslint-disable-next-line class-methods-use-this
    private prepareRequest(request: Request & { params?: Record<string, unknown> }, findResult: FindResult<RequestHandler<Request, Response>>) {
        request.params = {
            ...findResult.params,
            ...request.params, // original params will take precedence
        };
    }
}

export const createRouter = <
    Request extends IncomingMessage,
    Response extends ServerResponse,
    Schema extends ZodObject<any> = ZodObject<{ body?: ZodObject<any>; headers?: ZodObject<any>; query?: ZodObject<any> }>,
>(
    options: HandlerOptions<RoutesExtendedRequestHandler<Request, Response, Response, Route<Nextable<FunctionLike>>[]>> = {},
): NodeRouter<Request, Response, Schema> => new NodeRouter<Request, Response, Schema>(options);
