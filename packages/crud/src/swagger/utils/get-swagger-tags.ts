import type { ModelsConfig, SwaggerModelsConfig, SwaggerTag } from "../types.d";

const getSwaggerTags = <M extends string>(modelNames: M[], modelsConfig?: SwaggerModelsConfig<M>): SwaggerTag[] => modelNames.map((modelName) => {
    if (modelsConfig?.[modelName]?.tag) {
        return (modelsConfig[modelName as M] as ModelsConfig).tag;
    }

    return {
        name: modelName,
    };
});

export default getSwaggerTags;
