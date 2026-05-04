import type { NextApiRequest, NextApiResponse } from "next";

import baseHandler from "../../../base-crud-handler";
import type { Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters } from "../../../types";

const handler = async <
    T,
    Q extends ParsedQueryParameters = ParsedQueryParameters,
    R extends NextApiRequest = NextApiRequest,
    Response extends NextApiResponse = NextApiResponse,
    M extends string = string,
>(
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, Response>> =>
    await baseHandler<R, Response, T, Q, M>(
        // eslint-disable-next-line @typescript-eslint/require-await -- baseHandler requires async response executor signature
        async (response, responseConfig) => {
            response.status(responseConfig.status).send(responseConfig.data);
        },
        // eslint-disable-next-line @typescript-eslint/require-await -- baseHandler requires async finalExecutor signature
        async (response) => {
            response.end();
        },
        adapter,
        options,
    );

export default handler;
