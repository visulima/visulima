import type { ModelOption, ModelsOptions } from "../../types.d";
import getAccessibleRoutes from "../../utils/get-accessible-routes";
import type { Routes } from "../types.d";

const getModelsAccessibleRoutes = <M extends string>(modelNames: M[], models?: ModelsOptions<M>, defaultExposeStrategy: "all" | "none" = "all"): Routes<M> =>
    // eslint-disable-next-line unicorn/no-array-reduce
    modelNames.reduce((accumulator, modelName) => {
        if (models?.[modelName as M]) {
            return {
                ...accumulator,
                [modelName]: getAccessibleRoutes(
                    (models[modelName as M] as ModelOption).only,
                    (models[modelName as M] as ModelOption).exclude,
                    defaultExposeStrategy,
                ),
            };
        }

        return {
            ...accumulator,
            [modelName]: getAccessibleRoutes(undefined, undefined, defaultExposeStrategy),
        };
    }, {});

export default getModelsAccessibleRoutes;
