import type { OpenAPIV3 } from "openapi-types";

import type { ModelsConfig, SwaggerModelsConfig } from "../types.d";

const getOpenapiTags = <M extends string>(modelNames: M[], modelsConfig?: SwaggerModelsConfig<M>): OpenAPIV3.TagObject[] =>
    modelNames.map((modelName) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (modelsConfig?.[modelName]?.tag !== undefined) {
            return (modelsConfig[modelName] as ModelsConfig).tag;
        }

        return {
            name: modelName,
        };
    });

export default getOpenapiTags;
