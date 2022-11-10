import createHttpError from "http-errors";

import type { UniqueResourceHandlerParameters } from "../types.d";

type Handler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: any;
    status: number;
}>;

const readHandler: Handler = async ({
    adapter, query, resourceName, resourceId,
}) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    if (!resource) {
        throw createHttpError(404, `${resourceName} ${resourceId} not found`);
    }

    return {
        data: resource,
        status: 200,
    };
};

export default readHandler;
