import createHttpError from "http-errors";

import type { UpdateHandler } from "../types.d";

const updateHandler: UpdateHandler = async ({
    adapter, query, resourceName, resourceId, request,
}) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (resource) {
        const updatedResource = await adapter.update(resourceName, resourceId, request.body, query);

        return {
            status: 201,
            data: updatedResource,
        };
    }

    throw createHttpError(404, `${resourceName} ${resourceId} not found`);
};

export default updateHandler;
