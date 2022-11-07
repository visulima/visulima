import { sendJson } from "@visulima/connect";
import { IncomingMessage, ServerResponse } from "node:http";

import type { HandlerParameters, RequestHandler } from "../types";

type Handler = <T, Q, Request extends IncomingMessage & { body: Record<string, any> }, Response extends ServerResponse>(
    parameters: HandlerParameters<T, Q>,
) => RequestHandler<Request, Response>;

const createHandler: Handler =
    ({ adapter, query, resourceName }) =>
    async (request, response) => {
        const data = await adapter.create(resourceName, request.body, query);

        sendJson(response, 201, data);
    };

export default createHandler;
