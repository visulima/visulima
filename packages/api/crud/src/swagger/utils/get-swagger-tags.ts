import type { OpenAPIV3 } from "openapi-types";

import type { SwaggerModelsConfig } from "../types";

const getSwaggerTags = <M extends string>(modelNames: M[], modelsConfig?: SwaggerModelsConfig<M>): OpenAPIV3.TagObject[] =>
    modelNames.map((modelName) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TS treats indexed access of mapped types as non-undefined but may be missing at runtime
        if (modelsConfig?.[modelName]?.tag) {
            return modelsConfig[modelName].tag;
        }

        return {
            name: modelName,
        };
    });

export default getSwaggerTags;
