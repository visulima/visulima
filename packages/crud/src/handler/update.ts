import createHttpError from "http-errors";

import type { UniqueResourceHandlerParameters } from "../types";

const updateHandler: Handler = async ({ adapter, query, request, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    if (typeof resource === "object") {
        const updatedResource = await adapter.update(resourceName, resourceId, request.body, query);

        return {
            data: updatedResource,
            status: 201,
        };
    }

    throw createHttpError(404, `${resourceName} ${resourceId} not found`);
};

export type Handler = <T, Q, Request>(
    parameters: UniqueResourceHandlerParameters<T, Q> & { request: Request & { body: Partial<T> } },
) => Promise<{
    data: any;
    status: number;
}>;

export default updateHandler;
