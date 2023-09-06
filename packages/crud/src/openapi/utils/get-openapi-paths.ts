import type { ModelOption, ModelsOptions } from "../../types.d";
import { RouteType } from "../../types.d";
import { getQueryParameters } from "../parameters";
import type { Routes, SwaggerModelsConfig } from "../types.d";
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    const methods: { [Method in HttpMethod]?: any } = {};

    routeTypes.forEach((routeType) => {
        if (routeTypes.includes(routeType)) {
            const returnType =
                // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-unnecessary-condition
                modelsConfig?.[modelName]?.routeTypes?.[routeType]?.response.name ?? modelsConfig?.[modelName as M]?.type?.name ?? modelName;
            const method: HttpMethod = getRouteTypeMethod(routeType);
            const response = generateSwaggerResponse(routeType, returnType);

            if (response === undefined) {
                throw new TypeError(`Route type ${routeType}; response config was not found.`);
            }

            methods[method as HttpMethod] = {
                parameters: getQueryParameters(routeType).map((queryParameter) => {
                    return { ...queryParameter, in: "query" };
                }),

                responses: {
                    [response.statusCode]: response.content,

                    // eslint-disable-next-line security/detect-object-injection
                    ...modelsConfig?.[modelName as M]?.routeTypes?.[routeType]?.responses,
                },
                // eslint-disable-next-line security/detect-object-injection
                summary: modelsConfig?.[modelName as M]?.routeTypes?.[routeType]?.summary,
                tags: [tag],
            };

            if (hasId) {
                methods[method as HttpMethod].parameters.push({
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
                methods[method as HttpMethod].requestBody = generateRequestBody("Update", returnType);
            } else if (routeType === RouteType.CREATE) {
                methods[method as HttpMethod].requestBody = generateRequestBody("Create", returnType);
            }
        }
    });

    return methods;
};

interface GetSwaggerPathsParameters<M extends string> {
    models?: ModelsOptions<M>;
    modelsConfig?: SwaggerModelsConfig<M>;
    routes: Routes<M>;
    routesMap?: { [key in M]?: string };
}

const getOpenapiPaths = <M extends string>({ models, modelsConfig, routes, routesMap }: GetSwaggerPathsParameters<M>): Record<string, any> =>
    // eslint-disable-next-line unicorn/no-array-reduce
    (Object.keys(routes) as M[]).reduce((accumulator: Record<string, any>, value: M) => {
        const routeTypes = routes[value as keyof typeof routes] as RouteType[];

        const resourceName = models?.[value as M]?.name ? (models[value as M] as ModelOption).name : routesMap?.[value as M] ?? value;

        const tag = modelsConfig?.[value as M]?.tag.name ?? value;

        if (routeTypes.includes(RouteType.CREATE) || routeTypes.includes(RouteType.READ_ALL)) {
            const path = `/${resourceName}`;
            const routeTypesToUse = [RouteType.READ_ALL, RouteType.CREATE].filter((routeType) => routeTypes.includes(routeType));

            accumulator[path as keyof typeof accumulator] = generateSwaggerPathObject({
                modelName: value as M,
                modelsConfig,
                routeTypes: routeTypesToUse,
                tag,
            });
        }

        if (routeTypes.includes(RouteType.READ_ONE) || routeTypes.includes(RouteType.UPDATE) || routeTypes.includes(RouteType.DELETE)) {
            const path = `/${resourceName}/{id}`;
            const routeTypesToUse = [RouteType.READ_ONE, RouteType.UPDATE, RouteType.DELETE].filter((routeType) => routeTypes.includes(routeType));

            accumulator[path as keyof typeof accumulator] = generateSwaggerPathObject({
                hasId: true,
                modelName: value as M,
                modelsConfig,
                routeTypes: routeTypesToUse,
                tag,
            });
        }

        return accumulator;
    }, {});

export default getOpenapiPaths;
