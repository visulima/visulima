import baseHandler from "../../../../base-crud-handler";
import type {
    Adapter, ExecuteHandler, HandlerOptions, ParsedQueryParameters,
} from "../../../../types";

async function handler<T, R extends Request, Context, Q extends ParsedQueryParameters = any, M extends string = string>(
    adapter: Adapter<T, Q>,
    options?: HandlerOptions<M, R, Context>,
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
