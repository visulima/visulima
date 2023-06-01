import type { CreateHandler } from "../types.d";

const createHandler: CreateHandler = async ({
    adapter, query, resourceName, request,
}) => {
    const resources = await adapter.create(resourceName, request.body, query);

    return {
        data: resources,
        status: 201,
    };
};

export default createHandler;
