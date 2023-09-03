import baseHandler from "../../../../base-crud-handler";
import type { Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters } from "../../../../types";

// eslint-disable-next-line func-style
async function handler<T, R extends Request, Context, Q extends ParsedQueryParameters = any, M extends string = string>(
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M, R, Context>,
): Promise<ExecuteHandler<R, Context>> {
    return await baseHandler<R, Context, T, Q, M>(
        async (_, responseConfig) =>
            new Response(JSON.stringify(responseConfig.data), {
                headers: {
                    "content-type": "application/json; charset=utf-8",
                },
                status: responseConfig.status,
            }),
        async () => {},
        adapter,
        options,
    );
}

export default handler;
