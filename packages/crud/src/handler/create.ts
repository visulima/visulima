import type { HandlerParameters } from "../types.d";

const createHandler: Handler = async ({
    adapter, query, resourceName, request,
}) => {
    const resources = await adapter.create(resourceName, request.body, query);

    return {
        data: resources,
        status: 201,
    };
};

export type Handler = <T, Q, Request>(
    parameters: HandlerParameters<T, Q> & { request: Request & { body: Record<string, any> } },
) => Promise<{
    data: any;
    status: number;
}>;

export default createHandler;
