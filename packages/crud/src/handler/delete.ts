import createHttpError from "http-errors";

import type { UniqueResourceHandlerParameters } from "../types";

const deleteHandler: Handler = async ({ adapter, query, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    if (typeof resource === "object") {
        const deletedResource = await adapter.delete(resourceName, resourceId, query);

        return {
            data: deletedResource,
            status: 200,
        };
    }

    throw createHttpError(404, `${resourceName} ${resourceId} not found`);
};

export type Handler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: any;
    status: number;
}>;
export default deleteHandler;
