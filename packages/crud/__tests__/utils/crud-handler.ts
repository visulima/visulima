import type { IncomingMessage, ServerResponse } from "node:http";

import baseHandler from "../../src/base-crud-handler";
import type { Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters } from "../../src/types.d";

// eslint-disable-next-line func-style
async function CrudHandler<T, Q extends ParsedQueryParameters = any, M extends string = string>(
    adapter: Adapter<T, Q, M>,
    options?: HandlerOptions<M, IncomingMessage, ServerResponse>,
): Promise<ExecuteHandler<IncomingMessage, ServerResponse>> {
    return await baseHandler<IncomingMessage, ServerResponse, T, Q, M>(
        async (response, responseConfig) => {
            response.statusCode = responseConfig.status;
            response.end(responseConfig.data);
        },
        async (response) => {
            response.end();
        },
        adapter,
        options,
    );
}

export default CrudHandler;
