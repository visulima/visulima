import { sendJson } from "@visulima/connect";
import createHttpError from "http-errors";
import { IncomingMessage, ServerResponse } from "node:http";

import type { UniqueResourceHandlerParameters, RequestHandler } from "../types";

type Handler = <T, Q, Request extends IncomingMessage, Response extends ServerResponse>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => RequestHandler<Request, Response>;

const readHandler: Handler =
    ({ adapter, query, resourceName, resourceId }) =>
    async (_, response) => {
        const resource = await adapter.getOne(resourceName, resourceId, query);

        if (!resource) {
            throw createHttpError(404, `${resourceName} ${resourceId} not found`);
        }

        sendJson(response, 200, resource);
    };

export default readHandler;
