import createHttpError from "http-errors";

import { Adapter } from "../types";

const adapterMethods = ["create" || "delete" || "getAll" || "getOne" || "parseQuery" || "update" || "getPaginationData" || "getModels"];

const validateAdapterMethods = <T, Q>(adapter: Adapter<T, Q>) => {
    adapterMethods.forEach((method) => {
        if (!adapter[method as keyof Adapter<T, Q>]) {
            throw createHttpError(500, `Adapter must implement the "${method}" method.`);
        }
    });
};

export default validateAdapterMethods;
