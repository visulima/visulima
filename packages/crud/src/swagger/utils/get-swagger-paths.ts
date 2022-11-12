import type { ModelOption, ModelsOptions } from "../../types.d";
import { RouteType } from "../../types.d";
import { getQueryParams as getQueryParameters } from "../parameters";
import type { Routes, SwaggerModelsConfig } from "../types.d";
import formatExampleReference from "./format-example-ref";
import formatSchemaReference from "./format-schema-ref";
import generateMethodForRouteType from "./generate-method-for-route-type";

const generateContentForSchema = (schemaName: string, isArray?: boolean) => {
    if (isArray) {
        return {
            type: "array",
            items: {
                $ref: formatSchemaReference(schemaName),
            },
        };
    }

    return {
        $ref: formatSchemaReference(schemaName),
    };
};

const generateSwaggerResponse = (routeType: RouteType, modelName: string): { statusCode: number; content: any } => {
    switch (routeType) {
        case RouteType.CREATE: {
            return {
                statusCode: 201,
                content: {
                    description: `${modelName} created`,
                    content: {
                        "application/json": {
                            schema: generateContentForSchema(modelName),
                        },
                    },
                },
            };
        }
        case RouteType.DELETE: {
            return {
                statusCode: 200,
                content: {
                    description: `${modelName} item deleted`,
                    content: {
                        "application/json": {
                            schema: generateContentForSchema(modelName),
                        },
                    },
                },
            };
        }
        case RouteType.READ_ALL: {
            return {
                statusCode: 200,
                content: {
                    description: `${modelName} list retrieved`,
                    content: {
                        "application/json": {
                            schema: {
                                oneOf: [generateContentForSchema(modelName, true), generateContentForSchema(`${modelName}Page`, false)],
                            },
                            examples: {
                                Default: {
                                    $ref: formatExampleReference(`${modelName}`),
                                },
                                Pagination: {
                                    $ref: formatExampleReference(`${modelName}Page`),
                                },
                            },
                        },
                    },
                },
            };
        }
        case RouteType.READ_ONE: {
            return {
                statusCode: 200,
                content: {
                    description: `${modelName} item retrieved`,
                    content: {
                        "application/json": {
                            schema: generateContentForSchema(modelName),
                        },
                    },
                },
            };
        }
        case RouteType.UPDATE: {
            return {
                statusCode: 200,
                content: {
                    description: `${modelName} item updated`,
                    content: {
                        "application/json": {
                            schema: generateContentForSchema(modelName),
                        },
                    },
                },
            };
        }
    }
};

const generateRequestBody = (schemaStartName: string, modelName: string) => {
    return {
        content: {
            "application/json": {
                schema: {
                    $ref: formatSchemaReference(`${schemaStartName}${modelName}`),
                },
            },
        },
    };
};

const formatSimpleRoute = (resourceName: string) => `/${resourceName}`;

const formatResourceAccessorRoute = (resourceName: string) => `/${resourceName}/{id}`;

interface GenerateSwaggerPathObjectParameters<M extends string> {
    tag: string;
    routeTypes: RouteType[];
    modelsConfig?: SwaggerModelsConfig<M>;
    modelName: M;
    hasId?: boolean;
}

const generateSwaggerPathObject = <M extends string>({
    tag, routeTypes, modelName, modelsConfig, hasId,
}: GenerateSwaggerPathObjectParameters<M>) => {
    const methods: { [key: string]: any } = {};

    routeTypes.forEach((routeType) => {
        if (routeTypes.includes(routeType)) {
            const returnType = modelsConfig?.[modelName]?.routeTypes?.[routeType]?.response?.name ?? modelsConfig?.[modelName]?.type?.name ?? modelName;
            const response = generateSwaggerResponse(routeType, returnType);
            const method = generateMethodForRouteType(routeType);

            methods[method] = {
                tags: [tag],
                summary: modelsConfig?.[modelName]?.routeTypes?.[routeType]?.summary,
                parameters: getQueryParameters(routeType).map((queryParameter) => {
                    return { ...queryParameter, in: "query" };
                }),
                responses: {
                    [response.statusCode]: response.content,
                    ...(modelsConfig?.[modelName]?.routeTypes?.[routeType]?.responses),
                },
            };

            if (hasId) {
                methods[method].parameters.push({
                    in: "path",
                    name: "id",
                    description: `ID of the ${modelName}`,
                    required: true,
                    schema: {
                        type: "string",
                    },
                });
            }

            if (routeType === RouteType.UPDATE || routeType === RouteType.CREATE) {
                switch (routeType) {
                    case RouteType.UPDATE: {
                        methods[method].requestBody = generateRequestBody("Update", returnType);
                        break;
                    }
                    case RouteType.CREATE: {
                        methods[method].requestBody = generateRequestBody("Create", returnType);
                        break;
                    }
                }
            }
        }
    });

    return methods;
};

interface GetSwaggerPathsParameters<M extends string> {
    routes: Routes<M>;
    modelsConfig?: SwaggerModelsConfig<M>;
    models?: ModelsOptions<M>;
    routesMap?: { [key in M]?: string };
}

const getSwaggerPaths = <M extends string>({
    routes, models, modelsConfig, routesMap,
}: GetSwaggerPathsParameters<M>) => Object.keys(routes).reduce((accumulator: { [key: string]: any }, value: string | M) => {
        const routeTypes = routes[value] as RouteType[];
        const resourceName = models?.[value]?.name ? (models[value] as ModelOption).name : routesMap?.[value as M] || value;
        const tag = modelsConfig?.[value]?.tag?.name || value;

        if (routeTypes.includes(RouteType.CREATE) || routeTypes.includes(RouteType.READ_ALL)) {
            const path = formatSimpleRoute(resourceName as string);
            const routeTypesToUse = [RouteType.READ_ALL, RouteType.CREATE].filter((routeType) => routeTypes.includes(routeType));

            accumulator[path] = generateSwaggerPathObject({
                tag,
                modelName: value as M,
                modelsConfig,
                routeTypes: routeTypesToUse,
            });
        }

        if (routeTypes.includes(RouteType.READ_ONE) || routeTypes.includes(RouteType.UPDATE) || routeTypes.includes(RouteType.DELETE)) {
            const path = formatResourceAccessorRoute(resourceName as string);
            const routeTypesToUse = [RouteType.READ_ONE, RouteType.UPDATE, RouteType.DELETE].filter((routeType) => routeTypes.includes(routeType));

            accumulator[path] = generateSwaggerPathObject({
                tag,
                modelName: value as M,
                modelsConfig,
                routeTypes: routeTypesToUse,
                hasId: true,
            });
        }

        return accumulator;
    }, {});

export default getSwaggerPaths;
