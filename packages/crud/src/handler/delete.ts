import createHttpError from "http-errors";

import type { DeleteHandler } from "../types";

const deleteHandler: DeleteHandler = async ({ adapter, query, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (resource) {
        const deletedResource = await adapter.delete(resourceName, resourceId, query);

        return {
            data: deletedResource,
            status: 200,
        };
    }

    throw createHttpError(404, `${resourceName} ${resourceId} not found`);
};

export default deleteHandler;
