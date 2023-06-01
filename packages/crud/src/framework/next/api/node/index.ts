import type { NextApiRequest, NextApiResponse } from "next";

import baseHandler from "../../../../base-crud-handler";
import type {
    Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters,
} from "../../../../types";

async function handler<
    T,
    Q extends ParsedQueryParameters = any,
    R extends NextApiRequest = NextApiRequest,
    Response extends NextApiResponse = NextApiResponse,
    M extends string = string,
>(adapter: Adapter<T, Q>, options?: HandlerOptions<M, R, Response>): Promise<ExecuteHandler<R, Response>> {
    return baseHandler<R, Response, T, Q, M>(
        async (response, responseConfig) => {
            response.status(responseConfig.status).send(responseConfig.data);
        },
        async (response) => {
            response.end();
        },
        adapter,
        options,
    );
}

export default handler;
