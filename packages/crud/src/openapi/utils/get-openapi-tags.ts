import type { OpenAPIV3 } from "openapi-types";

import type { ModelsConfig, SwaggerModelsConfig } from "../types.d";

const getOpenapiTags = <M extends string>(modelNames: M[], modelsConfig?: SwaggerModelsConfig<M>): OpenAPIV3.TagObject[] =>
    modelNames.map((modelName) => {
        if (modelsConfig?.[modelName as keyof typeof modelsConfig]?.tag !== undefined) {
            return (modelsConfig[modelName as keyof typeof modelsConfig] as ModelsConfig).tag;
        }

        return {
            name: modelName,
        };
    });

export default getOpenapiTags;
