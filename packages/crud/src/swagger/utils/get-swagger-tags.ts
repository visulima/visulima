import type { ModelsConfig, SwaggerModelsConfig } from "../types.d";
import type { OpenAPIV3 } from "openapi-types";

const getSwaggerTags = <M extends string>(modelNames: M[], modelsConfig?: SwaggerModelsConfig<M>): OpenAPIV3.TagObject[] => modelNames.map((modelName) => {
    if (modelsConfig?.[modelName]?.tag) {
        return (modelsConfig[modelName as M] as ModelsConfig).tag;
    }

    return {
        name: modelName,
    };
}) as OpenAPIV3.TagObject[];

export default getSwaggerTags;
