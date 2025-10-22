import type { ModelOption, ModelsOptions } from "../../types";
import { RouteType } from "../../types";
import { getQueryParameters } from "../parameters";
import type { Routes, SwaggerModelsConfig } from "../types";
import formatExampleReference from "./format-example-ref";
import formatSchemaReference from "./format-schema-ref";

interface GenerateSwaggerPathObjectParameters<M extends string> {
    hasId?: boolean;
    modelName: M;
    modelsConfig?: SwaggerModelsConfig<M>;
    routeTypes: RouteType[];
    tag: string;
}

type HttpMethod = "delete" | "get" | "post" | "put";

const generateContentForSchema = (schemaName: string, isArray?: boolean) => {
    if (isArray) {
        return {
            items: {
                $ref: formatSchemaReference(schemaName),
            },
            type: "array",
        };
    }

    return {
        $ref: formatSchemaReference(schemaName),
    };
};

const generateSwaggerResponse = (routeType: RouteType, modelName: string): { content: any; statusCode: number } | undefined => {
    if (routeType === RouteType.CREATE) {
        return {
            content: {
                content: {
                    "application/json": {
                        example: formatExampleReference(modelName),
                        schema: generateContentForSchema(modelName),
                    },
                },
                description: `${modelName} created`,
            },
            statusCode: 201,
        };
    }

    if (routeType === RouteType.DELETE) {
        return {
            content: {
                content: {
                    "application/json": {
                        example: formatExampleReference(modelName),
                        schema: generateContentForSchema(modelName),
                    },
                },
                description: `${modelName} item deleted`,
            },
            statusCode: 200,
        };
    }

    if (routeType === RouteType.READ_ALL) {
        return {
            content: {
                content: {
                    "application/json": {
                        examples: {
                            Default: {
                                $ref: formatExampleReference(`${modelName}s`),
                            },
                            Pagination: {
                                $ref: formatExampleReference(`${modelName}Page`),
                            },
                        },
                        schema: {
                            oneOf: [generateContentForSchema(modelName, true), generateContentForSchema(`${modelName}Page`, false)],
                        },
                    },
                },
                description: `${modelName} list retrieved`,
            },
            statusCode: 200,
        };
    }

    if (routeType === RouteType.READ_ONE) {
        return {
            content: {
                content: {
                    "application/json": {
                        example: formatExampleReference(modelName),
                        schema: generateContentForSchema(modelName),
                    },
                },
                description: `${modelName} item retrieved`,
            },
            statusCode: 200,
        };
    }

    if (routeType === RouteType.UPDATE) {
        return {
            content: {
                content: {
                    "application/json": {
                        example: formatExampleReference(modelName),
                        schema: generateContentForSchema(modelName),
                    },
                },
                description: `${modelName} item updated`,
            },
            statusCode: 200,
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
        case RouteType.DELETE: {
            return "delete";
        }
        case RouteType.READ_ALL:
        case RouteType.READ_ONE: {
            return "get";
        }
        case RouteType.UPDATE: {
            return "put";
        }
        default: {
            throw new TypeError(`Method for route type ${routeType as string} was not found.`);
        }
    }
};

const generateSwaggerPathObject = <M extends string>({
    hasId,
    modelName,
    modelsConfig,
    routeTypes,
    tag,
}: GenerateSwaggerPathObjectParameters<M>): Record<string, any> => {
    const methods: Record<string, any> = {};

    routeTypes.forEach((routeType) => {
        if (routeTypes.includes(routeType)) {
            const returnType = modelsConfig?.[modelName]?.routeTypes?.[routeType]?.response.name ?? modelsConfig?.[modelName]?.type?.name ?? modelName;
            const method: HttpMethod = getRouteTypeMethod(routeType);
            const response = generateSwaggerResponse(routeType, returnType);

            if (response === undefined) {
                throw new TypeError(`Route type ${routeType}; response config was not found.`);
            }

            methods[method] = {
                parameters: getQueryParameters(routeType).map((queryParameter) => {
                    return { ...queryParameter, in: "query" };
                }),

                responses: {
                    [response.statusCode]: response.content,

                    ...modelsConfig?.[modelName]?.routeTypes?.[routeType]?.responses,
                },

                summary: modelsConfig?.[modelName]?.routeTypes?.[routeType]?.summary,
                tags: [tag],
            };

            if (hasId) {
                methods[method].parameters.push({
                    description: `ID of the ${modelName}`,
                    in: "path",
                    name: "id",
                    required: true,
                    schema: {
                        type: "string",
                    },
                });
            }

            if (routeType === RouteType.UPDATE) {
                methods[method].requestBody = generateRequestBody("Update", returnType);
            } else if (routeType === RouteType.CREATE) {
                methods[method].requestBody = generateRequestBody("Create", returnType);
            }
        }
    });

    return methods;
};

const getSwaggerPaths = <M extends string>({ models, modelsConfig, routes, routesMap }: GetSwaggerPathsParameters<M>): Record<string, any> =>
    // eslint-disable-next-line unicorn/no-array-reduce
    Object.keys(routes).reduce((accumulator: Record<string, any>, value: M | string) => {
        const routeTypes = routes[value] as RouteType[];

        const resourceName = models?.[value]?.name ? (models[value] as ModelOption).name : routesMap?.[value as M] ?? value;

        const tag = modelsConfig?.[value]?.tag.name ?? value;

        if (routeTypes.includes(RouteType.CREATE) || routeTypes.includes(RouteType.READ_ALL)) {
            const path = `/${resourceName}`;
            const routeTypesToUse = [RouteType.READ_ALL, RouteType.CREATE].filter((routeType) => routeTypes.includes(routeType));

            accumulator[path] = generateSwaggerPathObject({
                modelName: value as M,
                modelsConfig,
                routeTypes: routeTypesToUse,
                tag,
            } as GenerateSwaggerPathObjectParameters<M>);
        }

        if (routeTypes.includes(RouteType.READ_ONE) || routeTypes.includes(RouteType.UPDATE) || routeTypes.includes(RouteType.DELETE)) {
            const path = `/${resourceName}/{id}`;
            const routeTypesToUse = [RouteType.READ_ONE, RouteType.UPDATE, RouteType.DELETE].filter((routeType) => routeTypes.includes(routeType));

            accumulator[path] = generateSwaggerPathObject({
                hasId: true,
                modelName: value as M,
                modelsConfig,
                routeTypes: routeTypesToUse,
                tag,
            } as GenerateSwaggerPathObjectParameters<M>);
        }

        return accumulator;
    }, {});

export interface GetSwaggerPathsParameters<M extends string> {
    models?: ModelsOptions<M>;
    modelsConfig?: SwaggerModelsConfig<M>;
    routes: Routes<M>;
    routesMap?: { [key in M]?: string };
}

export default getSwaggerPaths;
