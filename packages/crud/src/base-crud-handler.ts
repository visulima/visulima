import type { HttpError } from "http-errors";
import createHttpError from "http-errors";
// eslint-disable-next-line import/no-extraneous-dependencies
import { ApiError } from "next/dist/server/api-utils";
import type { IncomingMessage, ServerResponse } from "node:http";

import allHandler from "./handler/all";
import createHandler from "./handler/create";
import deleteHandler from "./handler/delete";
import readHandler from "./handler/read";
import updateHandler from "./handler/update";
import parseQuery from "./query-parser";
import type {
    Adapter, ExecuteHandler, HandlerOptions, HandlerParameters, ParsedQueryParameters,
} from "./types.d";
import { RouteType } from "./types.d";
import formatResourceId from "./utils/format-resource-id";
import getAccessibleRoutes from "./utils/get-accessible-routes";
import { getResourceNameFromUrl } from "./utils/get-resource-name-from-url";
import getRouteType from "./utils/get-route-type";
import validateAdapterMethods from "./utils/validate-adapter-methods";

type ResponseConfig = { status: number; data: any };

async function baseHandler<R extends Request, Context extends unknown, T, Q extends ParsedQueryParameters = any, M extends string = string>(
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

// eslint-disable-next-line radar/cognitive-complexity,max-len
async function baseHandler<R extends { url: string; method: string }, RResponse, T, Q extends ParsedQueryParameters = any, M extends string = string>(
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
        modelRoutes[modelName as M] = config?.models?.[modelName as M]?.name || routeNames?.[modelName] || modelName;
    });

    return async (request, responseOrContext) => {
        const { resourceName, modelName } = getResourceNameFromUrl(request.url as string, modelRoutes);

        if (!resourceName) {
            if (process.env.NODE_ENV === "development") {
                const mappedModels = await adapter.mapModelsToRouteNames?.();

                if (typeof mappedModels === "object") {
                    throw createHttpError(404, `Resource not found, possible models: ${Object.values(mappedModels).join(", ")}`);
                }
            }

            throw createHttpError(404, `Resource not found: ${request.url}`);
        }

        const { routeType, resourceId } = getRouteType(request.method as string, request.url as string, resourceName);

        if (routeType === null) {
            throw createHttpError(404, `Route not found: ${request.url}`);
        }

        const modelConfig = options?.models?.[modelName as M];

        const accessibleRoutes = getAccessibleRoutes(modelConfig?.only, modelConfig?.exclude, options?.exposeStrategy || "all");

        if (!accessibleRoutes.includes(routeType)) {
            throw createHttpError(404, `Route not found: ${request.url}`);
        }

        try {
            const resourceIdFormatted = modelConfig?.formatResourceId?.(resourceId as string) ?? config.formatResourceId(resourceId as string);

            await adapter.connect?.();

            const parsedQuery = parseQuery((request.url as string).split("?")[1]);
            const parameters: HandlerParameters<T, Q> = {
                adapter,
                query: adapter.parseQuery(modelName as M, parsedQuery),
                resourceName: modelName as string,
            };

            try {
                let responseConfig: ResponseConfig;

                switch (routeType) {
                    case RouteType.READ_ONE: {
                        responseConfig = await readHandler<T, Q>({
                            ...parameters,
                            resourceId: resourceIdFormatted,
                        });
                        break;
                    }
                    case RouteType.READ_ALL: {
                        responseConfig = await allHandler<T, Q>({
                            ...parameters,
                            query: {
                                ...parameters.query,
                                page: parsedQuery.page ? Number(parsedQuery.page) : undefined,
                                limit: parsedQuery.limit ? Number(parsedQuery.limit) : undefined,
                            },
                            pagination: config.pagination,
                        });
                        break;
                    }
                    case RouteType.CREATE: {
                        responseConfig = await createHandler<T, Q, R>({
                            ...parameters,
                            request: request as R & { body: Record<string, any> },
                        });
                        break;
                    }
                    case RouteType.UPDATE: {
                        responseConfig = await updateHandler<T, Q, R>({
                            ...parameters,
                            resourceId: resourceIdFormatted,
                            request: request as R & { body: Partial<T> },
                        });
                        break;
                    }
                    case RouteType.DELETE: {
                        responseConfig = await deleteHandler<T, Q>({
                            ...parameters,
                            resourceId: resourceIdFormatted,
                        });
                        break;
                    }
                    default: {
                        responseConfig = {
                            status: 404,
                            data: "Method not found",
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
