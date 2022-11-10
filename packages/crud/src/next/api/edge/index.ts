import baseHandler from "../../../base-crud-handler";
import type {
    Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters,
} from "../../../types.d";

async function handler<R extends Request, Context, T, Q extends ParsedQueryParameters = any, M extends string = string>(
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M>,
): Promise<ExecuteHandler<R, Context>> {
    return baseHandler<R, Context, T, Q, M>(
        async (_, responseConfig) => new Response(JSON.stringify(responseConfig.data), {
            status: responseConfig.status,
            headers: {
                "content-type": "application/json; charset=utf-8",
            },
        }),
        async () => {},
        adapter,
        options,
    );
}

export default handler;
