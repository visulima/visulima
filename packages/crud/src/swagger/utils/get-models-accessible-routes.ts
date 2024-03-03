import type { ModelOption, ModelsOptions } from "../../types";
import getAccessibleRoutes from "../../utils/get-accessible-routes";
import type { Routes } from "../types";

const getModelsAccessibleRoutes = <M extends string>(modelNames: M[], models?: ModelsOptions<M>, defaultExposeStrategy: "all" | "none" = "all"): Routes<M> =>
    // eslint-disable-next-line unicorn/no-array-reduce
    modelNames.reduce((accumulator, modelName) => {
        if (models?.[modelName]) {
            return {
                ...accumulator,
                [modelName]: getAccessibleRoutes((models[modelName] as ModelOption).only, (models[modelName] as ModelOption).exclude, defaultExposeStrategy),
            };
        }

        return {
            ...accumulator,
            [modelName]: getAccessibleRoutes(undefined, undefined, defaultExposeStrategy),
        };
    }, {});

export default getModelsAccessibleRoutes;
