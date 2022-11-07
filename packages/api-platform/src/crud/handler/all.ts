import { sendJson } from "@visulima/connect";
import { IncomingMessage, ServerResponse } from "node:http";

import type { HandlerParameters, RequestHandler } from "../types";

type Handler = <T, Q, Request extends IncomingMessage & { body: Record<string, any> }, Response extends ServerResponse>(
    parameters: HandlerParameters<T, Q>,
) => RequestHandler<Request, Response>;

const allHandler: Handler =
   ({ adapter, query, resourceName }) =>
    async (_, response) => {
        let isPaginated = false;

        const paginationOptions = getPaginationOptions(query, pagination)

        if (paginationOptions) {
          isPaginated = true
          applyPaginationOptions(query, paginationOptions)
        }

        if (isPaginated) {
            const pagination = await adapter.getPaginationData(resourceName, query);

            sendJson(response, 200, pagination.toJSON());
        } else {
            const resources = await adapter.getAll(resourceName, query);

            sendJson(response, 200, resources);
        }
    };

export default allHandler;
