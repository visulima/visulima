import createHttpError from "http-errors";

import type { UniqueResourceHandlerParameters } from "../types.d";

const updateHandler: Handler = async ({
    adapter, query, resourceName, resourceId, request,
}) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    if (resource) {
        const updatedResource = await adapter.update(resourceName, resourceId, request.body, query);

        return {
            status: 201,
            data: updatedResource,
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
