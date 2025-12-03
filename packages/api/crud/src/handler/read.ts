import createHttpError from "http-errors";

import type { UniqueResourceHandlerParameters } from "../types";

const readHandler: Handler = async ({ adapter, query, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    if (typeof resource !== "object") {
        throw createHttpError(404, `${resourceName} ${resourceId} not found`);
    }

    return {
        data: resource,
        status: 200,
    };
};

export type Handler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: any;
    status: number;
}>;

export default readHandler;
