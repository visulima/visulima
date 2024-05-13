import createHttpError from "http-errors";

import type { UpdateHandler } from "../types";

const updateHandler: UpdateHandler = async ({ adapter, query, request, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (resource) {
        const updatedResource = await adapter.update(resourceName, resourceId, request.body, query);

        return {
            data: updatedResource,
            status: 201,
        };
    }

    throw createHttpError(404, `${resourceName} ${resourceId} not found`);
};

export default updateHandler;
