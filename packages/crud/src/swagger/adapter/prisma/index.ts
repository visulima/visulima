// eslint-disable-next-line import/no-extraneous-dependencies
import {
    // @ts-ignore
    PrismaClient,
} from "@prisma/client";
import type { OpenAPIV3 } from "openapi-types";

import modelsToRouteNames from "../../../adapter/prisma/utils/models-to-route-names";
import type { ModelsOptions } from "../../../types.d";
import PrismaJsonSchemaParser from "../../json-schema-parser";
import type { SwaggerModelsConfig } from "../../types.d";
import getModelsAccessibleRoutes from "../../utils/get-models-accessible-routes";
import getSwaggerPaths from "../../utils/get-swagger-paths";
import getSwaggerTags from "../../utils/get-swagger-tags";

const overwritePathsExampleWithModel = (swaggerPaths: OpenAPIV3.PathsObject, examples: { [key: string]: { value: any } }): OpenAPIV3.PathsObject => {
    // eslint-disable-next-line radar/cognitive-complexity
    Object.values(swaggerPaths).forEach((pathSpec) => {
        Object.values(pathSpec as OpenAPIV3.PathsObject & OpenAPIV3.OperationObject).forEach((methodSpec) => {
            if (typeof (methodSpec as OpenAPIV3.OperationObject).responses === "object") {
                Object.values((methodSpec as OpenAPIV3.OperationObject).responses).forEach((responseSpec) => {
                    if (typeof (responseSpec as OpenAPIV3.ResponseObject).content === "object") {
                        Object.values(
                            (responseSpec as OpenAPIV3.ResponseObject).content as {
                                [media: string]: OpenAPIV3.MediaTypeObject;
                            },
                        ).forEach((contentSpec) => {
                            if (typeof (contentSpec as OpenAPIV3.MediaTypeObject).example === "string") {
                                const example = ((contentSpec as OpenAPIV3.MediaTypeObject).example as string).replace("#/components/examples/", "");

                                if (
                                    typeof examples[example as keyof typeof examples] !== undefined
                                    && typeof examples[example as keyof typeof examples]?.value !== undefined
                                ) {
                                    // eslint-disable-next-line no-param-reassign
                                    (contentSpec as OpenAPIV3.MediaTypeObject).example = (examples[example as keyof typeof examples] as typeof examples).value;
                                }
                            }
                        });
                    }
                });
            }
        });
    });

    return swaggerPaths;
};

const modelsToOpenApi = async <M extends string = string>({
    prismaClient,
    models: ctorModels,
    swagger = { models: {}, allowedMediaTypes: { "application/json": true } },
    crud = { models: {} },
    defaultExposeStrategy = "all",
}: ModelsToOpenApiParameters<M>): Promise<{
    schemas: {
        [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
    };
    examples: {
        [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    };
    tags: OpenAPIV3.TagObject[];
    paths: OpenAPIV3.PathsObject;
}> => {
    let dmmf: any;
    let prismaDmmfModels: any;

    // eslint-disable-next-line no-underscore-dangle
    if (prismaClient._dmmf) {
        // eslint-disable-next-line no-underscore-dangle
        dmmf = prismaClient._dmmf;
        prismaDmmfModels = dmmf?.mappingsMap;
        // eslint-disable-next-line no-underscore-dangle
    } else if (prismaClient._getDmmf) {
        // eslint-disable-next-line no-underscore-dangle
        dmmf = await prismaClient._getDmmf();
        prismaDmmfModels = dmmf.mappingsMap;
    }

    if (typeof dmmf === undefined) {
        throw new TypeError("Couldn't get prisma client models");
    }

    const parser = new PrismaJsonSchemaParser(dmmf);

    const definitions = parser.parseModels();
    const dModels = Object.keys(definitions);

    const schema = JSON.stringify({
        ...definitions,
        ...parser.parseInputTypes(dModels),
        ...parser.getPaginationDataSchema(),
        ...parser.getPaginatedModelsSchemas(dModels),
    });

    if (ctorModels !== undefined) {
        ctorModels.forEach((model) => {
            if (!Object.keys(prismaDmmfModels).includes(model)) {
                throw new Error(`Model name ${model} is invalid.`);
            }
        });
    }

    // @ts-ignore
    const models = ctorModels ?? (Object.keys(prismaDmmfModels) as M[]);

    const swaggerRoutes = getModelsAccessibleRoutes(models, crud.models || {}, defaultExposeStrategy);
    const swaggerTags = getSwaggerTags(models, swagger?.models || {});
    const swaggerPaths = getSwaggerPaths({
        routes: swaggerRoutes,
        modelsConfig: swagger?.models || {},
        models: crud.models || {},
        routesMap: modelsToRouteNames(prismaDmmfModels, models),
    });
    const schemas = JSON.parse(schema.replace(/#\/definitions/g, "#/components/schemas"));
    const examples = parser.getExampleModelsSchemas(dModels, schemas);

    return {
        schemas,
        examples,
        tags: swaggerTags,
        paths: overwritePathsExampleWithModel(swaggerPaths, examples),
    };
};

export interface ModelsToOpenApiParameters<M extends string = string> {
    prismaClient: PrismaClient;
    defaultExposeStrategy?: "all" | "none";
    models?: M[];
    swagger?: Partial<{
        models: SwaggerModelsConfig<M>;
        allowedMediaTypes: { [key: string]: boolean };
    }>;
    crud?: {
        models: ModelsOptions<M>;
    };
}

export default modelsToOpenApi;
