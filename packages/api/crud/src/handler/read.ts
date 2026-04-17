import createHttpError from "http-errors";

import type { GetHandler } from "../types";

const readHandler: GetHandler = async ({ adapter, query, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    if (typeof resource !== "object") {
        throw createHttpError(404, `${resourceName} ${resourceId} not found`);
    }

    return {
        data: resource,
        status: 200,
    };
};

export default readHandler;
