import type { OpenAPIV3 } from "openapi-types";

import type { ModelsConfig, SwaggerModelsConfig } from "../types";

const getSwaggerTags = <M extends string>(modelNames: M[], modelsConfig?: SwaggerModelsConfig<M>): OpenAPIV3.TagObject[] =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    modelNames.map((modelName) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (modelsConfig?.[modelName]?.tag) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return (modelsConfig[modelName] as ModelsConfig).tag;
        }

        return {
            name: modelName,
        };
    });

export default getSwaggerTags;
