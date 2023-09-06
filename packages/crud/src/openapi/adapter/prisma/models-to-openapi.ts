import type { OpenAPIV3 } from "openapi-types";

import modelsToRouteNames from "../../../adapter/prisma/utils/models-to-route-names";
import type { FakePrismaClient, ModelsOptions } from "../../../types.d";
import PrismaJsonSchemaParser from "./json-schema-parser";
import type { SwaggerModelsConfig } from "../../types.d";
import getModelsAccessibleRoutes from "../../utils/get-models-accessible-routes";
import getOpenapiPaths from "../../utils/get-openapi-paths";
import getOpenapiTags from "../../utils/get-openapi-tags";

const overwritePathsExampleWithModel = (swaggerPaths: OpenAPIV3.PathsObject, examples: Record<string, OpenAPIV3.ExampleObject>): OpenAPIV3.PathsObject => {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    Object.values(swaggerPaths).forEach((pathSpec) => {
        Object.values(pathSpec as OpenAPIV3.OperationObject & OpenAPIV3.PathsObject).forEach((methodSpec) => {
            if (typeof (methodSpec as OpenAPIV3.OperationObject).responses === "object") {
                Object.values((methodSpec as OpenAPIV3.OperationObject).responses).forEach((responseSpec) => {
                    if (typeof (responseSpec as OpenAPIV3.ResponseObject).content === "object") {
                        Object.values((responseSpec as OpenAPIV3.ResponseObject).content as Record<string, OpenAPIV3.MediaTypeObject>).forEach(
                            (contentSpec) => {
                                if (typeof contentSpec.example === "string") {
                                    const example = contentSpec.example.replace("#/components/examples/", "");

                                    if (examples[example as keyof typeof examples]?.value !== undefined) {
                                        // eslint-disable-next-line no-param-reassign
                                        contentSpec.example = (examples[example as keyof typeof examples] as typeof examples)["value"];
                                    }
                                }
                            },
                        );
                    }
                });
            }
        });
    });

    return swaggerPaths;
};

const modelsToOpenapi = async <M extends string = string, PrismaClient = FakePrismaClient>(
    prismaClient: FakePrismaClient & PrismaClient,
    // eslint-disable-next-line no-use-before-define
    { crud, exposeStrategy, models: ctorModels, swagger }: ModelsToOpenApiParameters<M> = {},
): Promise<{
    components: {
        examples: Record<string, OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject>;
        schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>;
    };
    paths: OpenAPIV3.PathsObject;
    tags: OpenAPIV3.TagObject[];
}> => {
    let dmmf: any;
    let prismaDmmfModels: any;

    // eslint-disable-next-line no-underscore-dangle
    if (prismaClient._dmmf !== undefined) {
        // eslint-disable-next-line no-underscore-dangle
        dmmf = prismaClient._dmmf;
        prismaDmmfModels = dmmf?.mappingsMap;
        // eslint-disable-next-line no-underscore-dangle
    } else if (prismaClient._getDmmf !== undefined) {
        // eslint-disable-next-line no-underscore-dangle
        dmmf = await prismaClient._getDmmf();
        prismaDmmfModels = dmmf.mappingsMap;
    }

    if (dmmf === undefined) {
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
    const swaggerRoutes = getModelsAccessibleRoutes(models, crud?.models ?? {}, exposeStrategy ?? "all");
    const swaggerTags = getOpenapiTags(models, swagger?.models ?? {});
    const swaggerPaths = getOpenapiPaths({
        models: crud?.models ?? {},
        modelsConfig: swagger?.models ?? {},
        routes: swaggerRoutes,
        routesMap: modelsToRouteNames(prismaDmmfModels, models),
    });

    const schemas = JSON.parse(schema.replaceAll("#/definitions", "#/components/schemas"));
    const examples = parser.getExampleModelsSchemas(dModels, schemas);

    return {
        components: { examples, schemas },
        paths: overwritePathsExampleWithModel(swaggerPaths, examples as Record<string, OpenAPIV3.ExampleObject>),
        tags: swaggerTags,
    };
};

export interface ModelsToOpenApiParameters<M extends string> {
    crud?: {
        models: ModelsOptions<M>;
    };
    exposeStrategy?: "all" | "none";
    models?: M[];
    swagger?: Partial<{
        allowedMediaTypes: Record<string, boolean>;
        models: SwaggerModelsConfig<M>;
    }>;
}

export default modelsToOpenapi;
