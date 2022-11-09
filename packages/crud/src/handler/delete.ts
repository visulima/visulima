import createHttpError from "http-errors";

import type { UniqueResourceHandlerParameters } from "../types";

type Handler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: any;
    status: number;
}>;

const deleteHandler: Handler = async ({
    adapter, query, resourceName, resourceId,
}) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

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
