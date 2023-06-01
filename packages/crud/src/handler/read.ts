import createHttpError from "http-errors";

import type { GetHandler } from "../types.d";

const readHandler: GetHandler = async ({
    adapter, query, resourceName, resourceId,
}) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!resource) {
        throw createHttpError(404, `${resourceName} ${resourceId} not found`);
    }

    return {
        data: resource,
        status: 200,
    };
};

export default readHandler;
