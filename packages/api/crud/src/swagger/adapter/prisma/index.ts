import type { OpenAPIV3 } from "openapi-types";

import modelsToRouteNames from "../../../adapter/prisma/utils/models-to-route-names";
import type { FakePrismaClient, ModelsOptions } from "../../../types";
import PrismaJsonSchemaParser from "../../json-schema-parser";
import type { SwaggerModelsConfig } from "../../types";
import getModelsAccessibleRoutes from "../../utils/get-models-accessible-routes";
import getSwaggerPaths from "../../utils/get-swagger-paths";
import getSwaggerTags from "../../utils/get-swagger-tags";

const applyExampleToContent = (contentSpec: OpenAPIV3.MediaTypeObject, examples: Record<string, OpenAPIV3.ExampleObject>) => {
    if (typeof contentSpec.example === "string") {
        const example = contentSpec.example.replace("#/components/examples/", "");

        if (examples[example]?.value !== undefined) {
            // eslint-disable-next-line no-param-reassign
            contentSpec.example = (examples[example] as typeof examples).value;
        }
    }
};

const overwritePathsExampleWithModel = (swaggerPaths: OpenAPIV3.PathsObject, examples: Record<string, OpenAPIV3.ExampleObject>): OpenAPIV3.PathsObject => {
    Object.values(swaggerPaths).forEach((pathSpec) => {
        Object.values(pathSpec as OpenAPIV3.PathsObject).forEach((methodSpec) => {
            if (typeof (methodSpec as OpenAPIV3.OperationObject).responses === "object") {
                Object.values((methodSpec as OpenAPIV3.OperationObject).responses).forEach((responseSpec) => {
                    if (typeof (responseSpec as OpenAPIV3.ResponseObject).content === "object") {
                        Object.values((responseSpec as OpenAPIV3.ResponseObject).content as Record<string, OpenAPIV3.MediaTypeObject>).forEach(
                            // eslint-disable-next-line sonarjs/no-nested-functions -- OpenAPI's paths -> methods -> responses -> content shape requires 4 levels of forEach traversal
                            (contentSpec) => {
                                applyExampleToContent(contentSpec, examples);
                            },
                        );
                    }
                });
            }
        });
    });

    return swaggerPaths;
};

const modelsToOpenApi = async <M extends string = string, PrismaClient = FakePrismaClient>({
    crud = { models: {} },
    defaultExposeStrategy = "all",
    models: ctorModels,
    prismaClient,
    swagger = { allowedMediaTypes: { "application/json": true }, models: {} },
}: ModelsToOpenApiParameters<M, PrismaClient>): Promise<{
    examples: Record<string, OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject>;
    paths: OpenAPIV3.PathsObject;

    schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>;
    tags: OpenAPIV3.TagObject[];
}> => {
    type Dmmf = { mappingsMap: Record<string, object> };
    let dmmf: Dmmf | undefined;
    let prismaDmmfModels: Record<string, object> | undefined;

    // eslint-disable-next-line no-underscore-dangle
    if (prismaClient._dmmf !== undefined) {
        // eslint-disable-next-line no-underscore-dangle
        dmmf = prismaClient._dmmf as Dmmf;
        prismaDmmfModels = dmmf.mappingsMap;
        // eslint-disable-next-line no-underscore-dangle
    } else if (prismaClient._getDmmf !== undefined) {
        // eslint-disable-next-line no-underscore-dangle
        dmmf = (await prismaClient._getDmmf()) as Dmmf;
        prismaDmmfModels = dmmf.mappingsMap;
    }

    if (dmmf === undefined || prismaDmmfModels === undefined) {
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

    const models = ctorModels ?? (Object.keys(prismaDmmfModels) as M[]);

    const swaggerRoutes = getModelsAccessibleRoutes(models, crud.models, defaultExposeStrategy);
    const swaggerTags = getSwaggerTags(models, swagger.models);
    const swaggerPaths = getSwaggerPaths({
        models: crud.models,
        modelsConfig: swagger.models,
        routes: swaggerRoutes,
        routesMap: modelsToRouteNames(prismaDmmfModels, models),
    });
    const schemas = JSON.parse(schema.replaceAll("#/definitions", "#/components/schemas")) as Record<
        string,
        OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
    >;
    const examples = parser.getExampleModelsSchemas(dModels, schemas);

    return {
        examples,
        paths: overwritePathsExampleWithModel(swaggerPaths, examples as Record<string, OpenAPIV3.ExampleObject>),
        schemas,
        tags: swaggerTags,
    };
};

export interface ModelsToOpenApiParameters<M extends string, PrismaClient> {
    crud?: {
        models: ModelsOptions<M>;
    };
    defaultExposeStrategy?: "all" | "none";
    models?: M[];
    prismaClient: FakePrismaClient & PrismaClient;
    swagger?: Partial<{
        allowedMediaTypes: Record<string, boolean>;
        models: SwaggerModelsConfig<M>;
    }>;
}

export default modelsToOpenApi;
