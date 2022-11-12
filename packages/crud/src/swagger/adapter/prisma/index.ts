import {
    // @ts-ignore
    PrismaClient,
} from "@prisma/client";

import modelsToRouteNames from "../../../adapter/prisma/utils/models-to-route-names";
import type { ModelsOptions } from "../../../types.d";
import PrismaJsonSchemaParser from "../../json-schema-parser";
import type { SwaggerModelsConfig } from "../../types.d";
import { getModelsAccessibleRoutes } from "../../utils/get-models-accessible-routes";
import getSwaggerPaths from "../../utils/get-swagger-paths";
import getSwaggerTags from "../../utils/get-swagger-tags";

const modelsToOpenApi = async <M extends string = string>({
    prismaClient,
    models: ctorModels,
    swagger = { models: {} },
    crud = { models: {} },
    defaultExposeStrategy = "all",
}: ModelsToOpenApiParameters<M>) => {
    let dmmf: any;
    let prismaDmmfModels: any;

    // @ts-ignore
    if (prismaClient._dmmf) {
        // @ts-ignore
        dmmf = prismaClient._dmmf;
        prismaDmmfModels = dmmf?.mappingsMap;
    } else if (prismaClient._getDmmf) {
        // @ts-ignore
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

    if (typeof ctorModels !== "undefined") {
        ctorModels.forEach((model) => {
            if (!Object.keys(prismaDmmfModels).includes(model)) {
                throw new Error(`Model name ${model} is invalid.`);
            }
        });
    }

    const models =
        // @ts-ignore
        ctorModels
        // @ts-ignore
        ?? (Object.keys(prismaDmmfModels) as M[]);

    const swaggerRoutes = getModelsAccessibleRoutes(models, crud.models || {}, defaultExposeStrategy);
    const swaggerTags = getSwaggerTags(models, swagger?.models || {});
    const swaggerPaths = getSwaggerPaths({
        routes: swaggerRoutes,
        modelsConfig: swagger?.models || {},
        models: crud.models || {},
        routesMap: modelsToRouteNames(prismaDmmfModels, models),
    });
    const schemas = JSON.parse(schema.replace(/#\/definitions/g, "#/components/schemas"));

    return {
        schemas,
        examples: parser.getExampleModelsSchemas(dModels, schemas),
        tags: swaggerTags,
        paths: swaggerPaths,
    };
};

export interface ModelsToOpenApiParameters<M extends string = string>{
    prismaClient: PrismaClient;
    defaultExposeStrategy?: "all" | "none";
    models?: M[];
    swagger?: {
        models: SwaggerModelsConfig<M>;
    };
    crud?: {
        models: ModelsOptions<M>;
    };
}

export default modelsToOpenApi;
