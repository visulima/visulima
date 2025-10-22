import type { IncomingMessage, ServerResponse } from "node:http";

import type { HttpError } from "http-errors";
import createHttpError from "http-errors";
// eslint-disable-next-line import/no-extraneous-dependencies
import { ApiError } from "next/dist/server/api-utils";

import createHandler from "./handler/create";
import deleteHandler from "./handler/delete";
import listHandler from "./handler/list";
import readHandler from "./handler/read";
import updateHandler from "./handler/update";
import parseQuery from "./query-parser";
import type { Adapter, ExecuteHandler, HandlerOptions, HandlerParameters, ParsedQueryParameters } from "./types";
import { RouteType } from "./types";
import formatResourceId from "./utils/format-resource-id";
import getAccessibleRoutes from "./utils/get-accessible-routes";
import { getResourceNameFromUrl } from "./utils/get-resource-name-from-url";
import getRouteType from "./utils/get-route-type";
import validateAdapterMethods from "./utils/validate-adapter-methods";

interface ResponseConfig {
    data: any;
    status: number;
}

async function baseHandler<R extends Request, Context, T, Q extends ParsedQueryParameters = any, M extends string = string>(
    responseExecutor: (responseOrContext: Context, responseConfig: ResponseConfig) => Promise<Response>,
    finalExecutor: (responseOrContext: Context) => Promise<void>,
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, Context>>;

async function baseHandler<R extends IncomingMessage, RResponse extends ServerResponse, T, Q extends ParsedQueryParameters = any, M extends string = string>(
    responseExecutor: (responseOrContext: RResponse, responseConfig: ResponseConfig) => Promise<void>,
    finalExecutor: (responseOrContext: RResponse) => Promise<void>,
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, RResponse>>;

async function baseHandler<
    R extends { headers: { host?: string }; method: string; url: string },
    RResponse,
    T,
    Q extends ParsedQueryParameters = any,
    M extends string = string,
>(
    responseExecutor: (responseOrContext: RResponse, responseConfig: ResponseConfig) => Promise<RResponse>,
    finalExecutor: (responseOrContext: RResponse) => Promise<void>,
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, RResponse>> {
    try {
        validateAdapterMethods(adapter);
    } catch (error_: any) {
        const error = error_ as HttpError;

        throw new ApiError(error.statusCode, error.message);
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

    return async (request, responseOrContext) => {
        const { modelName, resourceName } = getResourceNameFromUrl(request.url, modelRoutes as { [key in M]: string });

        if (!resourceName) {
            if (process.env.NODE_ENV === "development") {
                const mappedModels = await adapter.mapModelsToRouteNames?.();

                if (typeof mappedModels === "object") {
                    throw createHttpError(404, `Resource not found, possible models: ${Object.values(mappedModels).join(", ")}`);
                }
            }

            throw createHttpError(404, `Resource not found: ${request.url}`);
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

        try {
            const resourceIdFormatted = modelConfig?.formatResourceId?.(resourceId as string) ?? config.formatResourceId(resourceId as string);

            await adapter.connect?.();

            const parsedQuery = parseQuery(`https://${request.headers.host?.replace(/\/$/u, "")}/${request.url}`);
            const parameters: HandlerParameters<T, Q> = {
                adapter,
                query: adapter.parseQuery(modelName as M, parsedQuery),
                resourceName: modelName,
            };

            try {
                let responseConfig: ResponseConfig;

                switch (routeType) {
                    case RouteType.CREATE: {
                        responseConfig = await (config.handlers?.create ?? createHandler)<T, Q, R>({
                            ...parameters,
                            request: request as R & { body: Record<string, any> },
                        });
                        break;
                    }
                    case RouteType.DELETE: {
                        responseConfig = await (config.handlers?.delete ?? deleteHandler)<T, Q>({
                            ...parameters,
                            resourceId: resourceIdFormatted,
                        });
                        break;
                    }
                    case RouteType.READ_ALL: {
                        responseConfig = await (config.handlers?.list ?? listHandler)<T, Q>({
                            ...parameters,
                            pagination: config.pagination,
                            query: {
                                ...parameters.query,
                                limit: parsedQuery.limit ? Number(parsedQuery.limit) : undefined,
                                page: parsedQuery.page ? Number(parsedQuery.page) : undefined,
                            },
                        });
                        break;
                    }
                    case RouteType.READ_ONE: {
                        responseConfig = await (config.handlers?.get ?? readHandler)<T, Q>({
                            ...parameters,
                            resourceId: resourceIdFormatted,
                        });
                        break;
                    }
                    case RouteType.UPDATE: {
                        responseConfig = await (config.handlers?.update ?? updateHandler)<T, Q, R>({
                            ...parameters,
                            request: request as R & { body: Partial<T> },
                            resourceId: resourceIdFormatted,
                        });
                        break;
                    }
                    default: {
                        responseConfig = {
                            data: "Method not found",
                            status: 404,
                        };
                    }
                }

                await responseExecutor(responseOrContext, responseConfig);
            } catch (error: any) {
                if (adapter.handleError && !(error instanceof ApiError)) {
                    adapter.handleError(error);
                } else {
                    throw error;
                }
            }
        } finally {
            await adapter.disconnect?.();

            await finalExecutor(responseOrContext);
        }
    };
}

export default baseHandler;
