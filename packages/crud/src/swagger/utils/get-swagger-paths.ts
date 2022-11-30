import type { ModelOption, ModelsOptions } from "../../types.d";
import { RouteType } from "../../types.d";
import { getQueryParameters } from "../parameters";
import type { Routes, SwaggerModelsConfig } from "../types.d";
import formatExampleReference from "./format-example-ref";
import formatSchemaReference from "./format-schema-ref";

interface GenerateSwaggerPathObjectParameters<M extends string> {
    tag: string;
    routeTypes: RouteType[];
    modelsConfig?: SwaggerModelsConfig<M>;
    modelName: M;
    hasId?: boolean;
}

type HttpMethod = "get" | "post" | "put" | "delete";

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

const generateSwaggerResponse = (routeType: RouteType, modelName: string): { statusCode: number; content: any } | undefined => {
    if (routeType === RouteType.CREATE) {
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

    if (routeType === RouteType.DELETE) {
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

    if (routeType === RouteType.READ_ALL) {
        return {
            statusCode: 200,
            content: {
                description: `${modelName} list retrieved`,
                content: {
                    "application/json": {
                        schema: {
                            oneOf: [generateContentForSchema(`${modelName}s`, true), generateContentForSchema(`${modelName}sPage`, false)],
                        },
                        examples: {
                            Default: {
                                $ref: formatExampleReference(`${modelName}s`),
                            },
                            Pagination: {
                                $ref: formatExampleReference(`${modelName}sPage`),
                            },
                        },
                    },
                },
            },
        };
    }

    if (routeType === RouteType.READ_ONE) {
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

    if (routeType === RouteType.UPDATE) {
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

    return undefined;
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

const getRouteTypeMethod = (routeType: RouteType): HttpMethod => {
    switch (routeType) {
        case RouteType.CREATE: {
            return "post";
        }
        case RouteType.READ_ALL:
        case RouteType.READ_ONE: {
            return "get";
        }
        case RouteType.UPDATE: {
            return "put";
        }
        case RouteType.DELETE: {
            return "delete";
        }
        default: {
            throw new TypeError(`Method for route type ${routeType} was not found.`);
        }
    }
};

const generateSwaggerPathObject = <M extends string>({
    tag, routeTypes, modelName, modelsConfig, hasId,
}: GenerateSwaggerPathObjectParameters<M>) => {
    const methods: { [key: string]: any } = {};

    routeTypes.forEach((routeType) => {
        if (routeTypes.includes(routeType)) {
            const returnType = modelsConfig?.[modelName]?.routeTypes?.[routeType]?.response?.name ?? modelsConfig?.[modelName]?.type?.name ?? modelName;
            const method: HttpMethod = getRouteTypeMethod(routeType);
            const response = generateSwaggerResponse(routeType, returnType);

            if (response === undefined) {
                throw new TypeError(`Route type ${routeType}; response config was not found.`);
            }

            methods[method as HttpMethod] = {
                tags: [tag],
                summary: modelsConfig?.[modelName]?.routeTypes?.[routeType]?.summary,
                parameters: getQueryParameters(routeType).map((queryParameter) => {
                    return { ...queryParameter, in: "query" };
                }),
                responses: {
                    [response.statusCode]: response.content,
                    ...modelsConfig?.[modelName]?.routeTypes?.[routeType]?.responses,
                },
            };

            if (hasId) {
                methods[method as HttpMethod].parameters.push({
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
                if (routeType === RouteType.UPDATE) {
                    methods[method as HttpMethod].requestBody = generateRequestBody("Update", returnType);
                } else if (routeType === RouteType.CREATE) {
                    methods[method as HttpMethod].requestBody = generateRequestBody("Create", returnType);
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
            const path = `/${resourceName}`;
            const routeTypesToUse = [RouteType.READ_ALL, RouteType.CREATE].filter((routeType) => routeTypes.includes(routeType));

            accumulator[path] = generateSwaggerPathObject({
                tag,
                modelName: value as M,
                modelsConfig,
                routeTypes: routeTypesToUse,
            });
        }

        if (routeTypes.includes(RouteType.READ_ONE) || routeTypes.includes(RouteType.UPDATE) || routeTypes.includes(RouteType.DELETE)) {
            const path = `/${resourceName}/{id}`;
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
