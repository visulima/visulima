import { sendJson } from "@visulima/connect";
import type { HttpError } from "http-errors";
import { ApiError } from "next/dist/server/api-utils";
import type { IncomingMessage, ServerResponse } from "node:http";

import allHandler from "../handler/all";
import createHandler from "../handler/create";
import deleteHandler from "../handler/delete";
import readHandler from "../handler/read";
import updateHandler from "../handler/update";
import parseQuery from "../query-parser";
import type {
    Adapter, HandlerOptions, HandlerParameters, ParsedQueryParameters,
} from "../types.d";
import { RouteType } from "../types.d";
import formatResourceId from "../utils/format-resource-id";
import { getResourceNameFromUrl } from "../utils/get-resource-name-from-url";
import getRouteType from "../utils/get-route-type";
import validateAdapterMethods from "../utils/validate-adapter-methods";
import createHttpError from "http-errors";

interface ExecuteHandler<Request, Response> {
    (request: Request, response: Response): Promise<void>;
}

// eslint-disable-next-line radar/cognitive-complexity,max-len
async function index<Request extends IncomingMessage, Response extends ServerResponse, T, Q extends ParsedQueryParameters = any, M extends string = string>(
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<Request, Response>> {
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

    const routeNames = adapter.mapModelsToRouteNames?.();
    const modelRoutes: { [key in M]?: string } = {};

    adapter.getModels().forEach((modelName) => {
        modelRoutes[modelName as M] = config?.models?.[modelName as M]?.name || routeNames?.[modelName] || modelName;
    });

    return async (request, response) => {
        const { resourceName, modelName } = getResourceNameFromUrl(request.url as string, modelRoutes);

        if (!resourceName) {
            if (process.env.NODE_ENV === "development") {
                const mappedModels = adapter.mapModelsToRouteNames?.();

                if (typeof mappedModels === "object") {
                    throw createHttpError(404, `Resource not found, possible models: ${Object.values(mappedModels).join(", ")}`);
                }
            }

            throw createHttpError(404, `Resource not found: ${request.url}`);
        }

        try {
            const { routeType, resourceId } = getRouteType(request.method as string, request.url as string, resourceName);

            const modelConfig = options?.models?.[modelName as M];
            const resourceIdFormatted = modelConfig?.formatResourceId?.(resourceId as string) ?? config.formatResourceId(resourceId as string);

            await adapter.connect?.();

            const parsedQuery = parseQuery((request.url as string).split("?")[1]);
            const parameters: HandlerParameters<T, Q> = {
                adapter,
                query: adapter.parseQuery(modelName as M, parsedQuery),
                resourceName: modelName as string,
            };

            try {
                let responseConfig: { status: number; data: any };

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
                            pagination: config.pagination,
                        });
                        break;
                    }
                    case RouteType.CREATE: {
                        responseConfig = await createHandler<T, Q, Request>({ ...parameters, request: request as Request & { body: Record<string, any>; } });
                        break;
                    }
                    case RouteType.UPDATE: {
                        responseConfig = await updateHandler<T, Q, Request>({
                            ...parameters,
                            resourceId: resourceIdFormatted,
                            request: request as Request & { body: Partial<T>; },
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

                sendJson(response, responseConfig.status, responseConfig.data);
            } catch (error: any) {
                if (adapter.handleError && !(error instanceof ApiError)) {
                    adapter.handleError(error);
                } else {
                    throw error;
                }
            }
        } finally {
            await adapter.disconnect?.();

            response.end();
        }
    };
}

export default index;
