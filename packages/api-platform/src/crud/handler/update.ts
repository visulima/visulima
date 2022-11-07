import { sendJson } from "@visulima/connect";
import createHttpError from "http-errors";
import { IncomingMessage, ServerResponse } from "node:http";

import type { UniqueResourceHandlerParameters, RequestHandler } from "../types";

type Handler = <T, Q, Request extends IncomingMessage & { body: Partial<T> }, Response extends ServerResponse>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => RequestHandler<Request, Response>;

const updateHandler: Handler =
    ({ adapter, query, resourceName, resourceId }) =>
    async (request, response) => {
        const resource = await adapter.getOne(resourceName, resourceId, query);

        if (resource) {
            const updatedResource = await adapter.update(resourceName, resourceId, request.body, query);

            sendJson(response, 201, updatedResource);
        } else {
            throw createHttpError(404, `${resourceName} ${resourceId} not found`);
        }
    };

export default updateHandler;
