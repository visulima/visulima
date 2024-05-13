import type { HttpError } from "http-errors";
import createHttpError from "http-errors";
// eslint-disable-next-line import/no-extraneous-dependencies
import { ApiError } from "next/dist/server/api-utils";
import type { IncomingMessage, ServerResponse } from "node:http";

import createHandler from "./handler/create";
import deleteHandler from "./handler/delete";
import listHandler from "./handler/list";
import readHandler from "./handler/read";
import updateHandler from "./handler/update";
import parseQuery from "./query-parser";
import { unmarshal } from "./serialization/json";
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
    options?: HandlerOptions<M, R, Context>,
): Promise<ExecuteHandler<R, Context>>;

async function baseHandler<R extends IncomingMessage, RResponse extends ServerResponse, T, Q extends ParsedQueryParameters = any, M extends string = string>(
    responseExecutor: (responseOrContext: RResponse, responseConfig: ResponseConfig) => Promise<void>,
    finalExecutor: (responseOrContext: RResponse) => Promise<void>,
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M, R, RResponse>,
): Promise<ExecuteHandler<R, RResponse>>;

// eslint-disable-next-line sonarjs/cognitive-complexity,func-style
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
    options?: HandlerOptions<M, R, RResponse>,
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
        serialization: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            marshal: (value: any) => value,
            unmarshal,
        },
        ...options,
    };

    if (typeof config.serialization.marshal !== "function") {
        throw new TypeError("Marshal function is required");
    }

    if (typeof config.serialization.unmarshal !== "function") {
        throw new TypeError("Unmarshal function is required");
    }

    const routeNames = await adapter.mapModelsToRouteNames?.();
    const modelRoutes: { [key in M]?: string } = {};

    adapter.getModels().forEach((modelName) => {
        modelRoutes[modelName as M] = config.models?.[modelName as M]?.name ?? routeNames?.[modelName as M] ?? modelName;
    });

    return async (request, responseOrContext) => {
        const { modelName, resourceName } = getResourceNameFromUrl(request.url, modelRoutes as { [key in M]: string });

        try {
            if (!resourceName) {
                // eslint-disable-next-line @typescript-eslint/dot-notation
                if (process.env["NODE_ENV"] === "development") {
                    const mappedModels = await adapter.mapModelsToRouteNames?.();

                    if (typeof mappedModels === "object") {
                        throw createHttpError(404, `Resource not found, possible models: ${Object.values(mappedModels).join(", ")}`);
                    }
                }

                throw createHttpError(404, `Resource not found: ${request.url}`);
            }

            const { resourceId, routeType } = getRouteType(request.method, request.url, resourceName);

            await config.callbacks?.onRequest?.(request, responseOrContext, {
                resourceId,
                resourceName,
                routeType,
            });

            if (routeType === null) {
                throw createHttpError(404, `Route not found: ${request.url}`);
            }

            const modelConfig = options?.models?.[modelName as M];

            const accessibleRoutes = getAccessibleRoutes(modelConfig?.only, modelConfig?.exclude, options?.exposeStrategy ?? "all");

            if (!accessibleRoutes.includes(routeType)) {
                throw createHttpError(404, `Route not found: ${request.url}`);
            }

            const resourceIdFormatted = modelConfig?.formatResourceId?.(resourceId as string) ?? config.formatResourceId(resourceId as string);

            await adapter.connect?.();

            const parsedQuery = parseQuery(`https://${request.headers.host?.replace(/\/$/, "")}/${request.url}`);
            const parameters: HandlerParameters<T, Q> = {
                adapter,
                query: adapter.parseQuery(modelName as M, parsedQuery, config.serialization),
                resourceName: modelName,
            };

            const executeCrud = async (): Promise<ResponseConfig> => {
                try {
                    let responseConfig: ResponseConfig = {
                        data: "Method not found",
                        status: 404,
                    };

                    // eslint-disable-next-line default-case
                    switch (routeType) {
                        case RouteType.READ_ONE: {
                            responseConfig = await (config.handlers?.get ?? readHandler)<T, Q>({
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
                        case RouteType.CREATE: {
                            const typedRequest = request as R & { body: Record<string, any> };

                            typedRequest.body = config.serialization.unmarshal(typedRequest.body) as Record<string, any>;

                            responseConfig = await (config.handlers?.create ?? createHandler)<T, Q, R>({
                                ...parameters,
                                request: typedRequest,
                            });

                            break;
                        }
                        case RouteType.UPDATE: {
                            const typedRequest = request as R & { body: Partial<T> };

                            typedRequest.body = config.serialization.unmarshal(typedRequest.body) as Partial<T>;

                            responseConfig = await (config.handlers?.update ?? updateHandler)<T, Q, R>({
                                ...parameters,
                                request: typedRequest,
                                resourceId: resourceIdFormatted,
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
                    }

                    responseConfig.data = config.serialization.marshal(responseConfig.data);

                    return responseConfig;
                } catch (error: any) {
                    if (adapter.handleError && !(error instanceof ApiError)) {
                        adapter.handleError(error);
                    }

                    throw error;
                }
            };

            const responseConfig = await executeCrud();

            await responseExecutor(responseOrContext, responseConfig);

            await config.callbacks?.onSuccess?.(responseConfig);
        } catch (error: any) {
            await config.callbacks?.onError?.(request, responseOrContext, error);

            throw error;
        } finally {
            await adapter.disconnect?.();

            await finalExecutor(responseOrContext);
        }
    };
}

export default baseHandler;
