import baseHandler from "../../../base-crud-handler";
import type { Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters } from "../../../types.d";

const handler = async <T, R extends Request, Context, Q extends ParsedQueryParameters = any, M extends string = string>(
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, Context>> =>
    await baseHandler<R, Context, T, Q, M>(
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

export default handler;
