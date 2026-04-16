import type { CreateHandler } from "../types";

const createHandler: CreateHandler = async ({ adapter, query, request, resourceName }) => {
    const resources = await adapter.create(resourceName, request.body, query);

    return {
        data: resources,
        status: 201,
    };
};

export default createHandler;
