import { sendJson } from "@visulima/connect";
import createHttpError from "http-errors";
import { IncomingMessage, ServerResponse } from "node:http";

import type { UniqueResourceHandlerParameters, RequestHandler } from "../types";

type Handler = <T, Q, Request extends IncomingMessage, Response extends ServerResponse>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => RequestHandler<Request, Response>;

const deleteHandler: Handler =
    ({ adapter, query, resourceName, resourceId }) =>
    async (_, response) => {
        const resource = await adapter.getOne(resourceName, resourceId, query);

        if (resource) {
            const deletedResource = await adapter.delete(resourceName, resourceId, query);

            sendJson(response, 200, deletedResource);
        } else {
            throw createHttpError(404, `${resourceName} ${resourceId} not found`);
        }
    };

export default deleteHandler;
