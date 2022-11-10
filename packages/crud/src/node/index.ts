import type { IncomingMessage, ServerResponse } from "node:http";

import baseHandler from "../base-crud-handler";
import type {
    Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters,
} from "../types.d";

async function handler<R extends IncomingMessage, Response extends ServerResponse, T, Q extends ParsedQueryParameters = any, M extends string = string>(
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, Response>> {
    return baseHandler<R, Response, T, Q, M>(
        async (response, responseConfig) => {
            response.setHeader("content-type", "application/json; charset=utf-8");

            response.statusCode = responseConfig.status;
            response.end(JSON.stringify(responseConfig.data, null, 2));
        },
        async (response) => {
            (response as Response).end();
        },
        adapter,
        options,
    );
}

export default handler;
