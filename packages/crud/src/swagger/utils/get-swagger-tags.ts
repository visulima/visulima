import type { OpenAPIV3 } from "openapi-types";

import type { ModelsConfig, SwaggerModelsConfig } from "../types";

const getSwaggerTags = <M extends string>(modelNames: M[], modelsConfig?: SwaggerModelsConfig<M>): OpenAPIV3.TagObject[] =>

    modelNames.map((modelName) => {
        if (modelsConfig?.[modelName]?.tag) {
            return (modelsConfig[modelName] as ModelsConfig).tag;
        }

        return {
            name: modelName,
        };
    });

export default getSwaggerTags;
