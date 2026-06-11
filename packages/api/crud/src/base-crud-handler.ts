import type { IncomingMessage, ServerResponse } from "node:http";

import type { HttpError } from "http-errors";
import createHttpError from "http-errors";

import CrudApiError from "./api-error";
import createHandler from "./handler/create";
import deleteHandler from "./handler/delete";
import listHandler from "./handler/list";
import readHandler from "./handler/read";
import updateHandler from "./handler/update";
import parseQuery from "./query-parser";
import type { Adapter, ExecuteHandler, HandlerOptions, HandlerParameters, ModelOption, ParsedQueryParameters } from "./types";
import { RouteType } from "./types";
import { applyReadPolicy, applyWritePolicy } from "./utils/apply-access-policy";
import formatResourceId from "./utils/format-resource-id";
import getAccessibleRoutes from "./utils/get-accessible-routes";
import { getResourceNameFromUrl } from "./utils/get-resource-name-from-url";
import getRouteType from "./utils/get-route-type";
import validateAdapterMethods from "./utils/validate-adapter-methods";

const TRAILING_SLASH_REGEX = /\/$/u;

interface ResponseConfig {
    data: unknown;
    status: number;
}

/**
 * Run an optional body validation/transform schema. Returns the schema's
 * (possibly transformed) output, or the original body when no schema is set.
 */
const runSchema = async (schema: ModelOption["createSchema"], body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (!schema) {
        return body;
    }

    return (await schema.parse(body)) as Record<string, unknown>;
};

/**
 * Read the `host` header from either a plain object request (Node/Next API
 * routes expose `headers` as a plain object) or a Fetch `Request` whose
 * `headers` is a `Headers` instance (App Router / edge runtimes).
 */
const readHostHeader = (request: { headers: unknown }): string => {
    const { headers } = request;

    if (headers && typeof (headers as Headers).get === "function") {
        return (headers as Headers).get("host") ?? "";
    }

    return (headers as { host?: string } | undefined)?.host ?? "";
};

/**
 * Throw a 404 for an unresolved resource. In development the error message also
 * lists the available models to make misconfiguration obvious.
 */
const throwResourceNotFound = async (adapter: { mapModelsToRouteNames?: () => Promise<Record<string, string | undefined>> }, url: string): Promise<never> => {
    if (process.env.NODE_ENV === "development") {
        const mappedModels = await adapter.mapModelsToRouteNames?.();

        if (typeof mappedModels === "object") {
            throw createHttpError(404, `Resource not found, possible models: ${Object.values(mappedModels).join(", ")}`);
        }
    }

    throw createHttpError(404, `Resource not found: ${url}`);
};

interface DispatchContext<R, T, Q extends ParsedQueryParameters> {
    config: {
        handlers?: HandlerOptions["handlers"];
        pagination: { perPage: number };
    };
    modelConfig: ModelOption | undefined;
    parameters: HandlerParameters<T, Q>;
    parsedQuery: ParsedQueryParameters;
    request: R;
    resourceIdFormatted: number | string;
    routeType: RouteType;
}

/**
 * Resolve the request to the matching CRUD handler and return its response
 * config. Extracted from the request closure to keep the latter's cognitive
 * complexity low.
 */
const dispatchRoute = async <R extends object, T, Q extends ParsedQueryParameters>({
    config,
    modelConfig,
    parameters,
    parsedQuery,
    request,
    resourceIdFormatted,
    routeType,
}: DispatchContext<R, T, Q>): Promise<ResponseConfig> => {
    switch (routeType) {
        case RouteType.CREATE: {
            const body = await runSchema(modelConfig?.createSchema, applyWritePolicy((request as { body?: Record<string, unknown> }).body ?? {}, modelConfig));

            return (config.handlers?.create ?? createHandler)<T, Q, R>({
                ...parameters,
                request: Object.assign(request, { body }),
            });
        }
        case RouteType.DELETE: {
            return (config.handlers?.delete ?? deleteHandler)<T, Q>({
                ...parameters,
                resourceId: resourceIdFormatted,
            });
        }
        case RouteType.READ_ALL: {
            return (config.handlers?.list ?? listHandler)<T, Q>({
                ...parameters,
                pagination: config.pagination,
                query: {
                    ...parameters.query,
                    limit: parsedQuery.limit ?? undefined,
                    page: parsedQuery.page ?? undefined,
                },
            });
        }
        case RouteType.READ_ONE: {
            return (config.handlers?.get ?? readHandler)<T, Q>({
                ...parameters,
                resourceId: resourceIdFormatted,
            });
        }
        case RouteType.UPDATE: {
            const body = await runSchema(modelConfig?.updateSchema, applyWritePolicy((request as { body?: Record<string, unknown> }).body ?? {}, modelConfig));

            return (config.handlers?.update ?? updateHandler)<T, Q, R>({
                ...parameters,
                request: Object.assign(request, { body }) as R & { body: Partial<T> },
                resourceId: resourceIdFormatted,
            });
        }
        default: {
            return {
                data: "Method not found",
                status: 404,
            };
        }
    }
};

async function baseHandler<R extends Request, Context, T, Q extends ParsedQueryParameters = ParsedQueryParameters, M extends string = string>(
    responseExecutor: (responseOrContext: Context, responseConfig: ResponseConfig) => Promise<Response>,
    finalExecutor: (responseOrContext: Context) => Promise<void>,
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, Context, Response>>;

async function baseHandler<
    R extends IncomingMessage,
    RResponse extends ServerResponse,
    T,
    Q extends ParsedQueryParameters = ParsedQueryParameters,
    M extends string = string,
>(
    responseExecutor: (responseOrContext: RResponse, responseConfig: ResponseConfig) => Promise<void>,
    finalExecutor: (responseOrContext: RResponse) => Promise<void>,
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, RResponse>>;

async function baseHandler<
    R extends { headers: { host?: string }; method: string; url: string },
    RResponse,
    T,
    Q extends ParsedQueryParameters = ParsedQueryParameters,
    M extends string = string,
>(
    responseExecutor: (responseOrContext: RResponse, responseConfig: ResponseConfig) => Promise<RResponse>,
    finalExecutor: (responseOrContext: RResponse) => Promise<void>,
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, RResponse, RResponse>> {
    try {
        validateAdapterMethods(adapter);
    } catch (error_) {
        const error = error_ as HttpError;

        throw new CrudApiError(error.statusCode, error.message);
    }

    await adapter.init?.();

    const config = {
        formatResourceId,
        pagination: {
            perPage: 20,
        },
        ...options,
    };

    const routeNames = await adapter.mapModelsToRouteNames?.();
    const modelRoutes: { [key in M]?: string } = {};

    adapter.getModels().forEach((modelName) => {
        modelRoutes[modelName as M] = config.models?.[modelName as M]?.name ?? routeNames?.[modelName] ?? modelName;
    });

    /**
     * Connect once at handler-factory time rather than on every request. The
     * Prisma adapter maps `connect`/`disconnect` to `$connect()`/`$disconnect()`;
     * doing that per request tore down and re-established the connection pool on
     * every call.
     */
    await adapter.connect?.();

    return async (request, responseOrContext) => {
        const { modelName, resourceName } = getResourceNameFromUrl(request.url, modelRoutes as { [key in M]: string });

        if (!resourceName) {
            await throwResourceNotFound(adapter, request.url);
        }

        const { resourceId, routeType } = getRouteType(request.method, request.url, resourceName);

        if (routeType === null) {
            throw createHttpError(404, `Route not found: ${request.url}`);
        }

        const modelConfig = options?.models?.[modelName as M];

        const accessibleRoutes = getAccessibleRoutes(modelConfig?.only, modelConfig?.exclude, options?.exposeStrategy ?? "all");

        if (!accessibleRoutes.includes(routeType)) {
            throw createHttpError(404, `Route not found: ${request.url}`);
        }

        const resourceIdFormatted = modelConfig?.formatResourceId?.(resourceId as string) ?? config.formatResourceId(resourceId as string);

        await options?.onRequest?.({
            method: request.method,
            resourceId: routeType === RouteType.CREATE || routeType === RouteType.READ_ALL ? undefined : resourceIdFormatted,
            resourceName: modelName,
            routeType,
            url: request.url,
        });

        try {
            const parsedQuery = parseQuery(`https://${readHostHeader(request).replace(TRAILING_SLASH_REGEX, "")}/${request.url}`);

            // Enforce read-side field allowlists (select/include/where/orderBy) before the adapter sees them.
            applyReadPolicy(parsedQuery, modelConfig);

            // Clamp the page size to a configurable maximum to prevent full-table dumps via `?limit=`.
            const maxPerPage = modelConfig?.maxPerPage ?? options?.maxPerPage;

            if (maxPerPage !== undefined && parsedQuery.limit !== undefined && parsedQuery.limit > maxPerPage) {
                parsedQuery.limit = maxPerPage;
            }

            const parameters: HandlerParameters<T, Q> = {
                adapter,
                query: adapter.parseQuery(modelName, parsedQuery),
                resourceName: modelName,
            };

            try {
                const responseConfig = await dispatchRoute<R, T, Q>({
                    config,
                    modelConfig,
                    parameters,
                    parsedQuery,
                    request,
                    resourceIdFormatted,
                    routeType,
                });

                // Thread the executor's return value back to the caller so Fetch-based
                // runtimes (App Router / edge) can `return` the produced `Response`.
                return await responseExecutor(responseOrContext, responseConfig);
            } catch (error: unknown) {
                if (adapter.handleError && !(error instanceof CrudApiError)) {
                    adapter.handleError(error as Error);
                } else {
                    throw error;
                }

                return responseOrContext;
            }
        } finally {
            await finalExecutor(responseOrContext);
        }
    };
}

export default baseHandler;
