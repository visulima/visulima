import type { IncomingMessage, ServerResponse } from "node:http";

import { NodeRouter } from "@visulima/connect";
// eslint-disable-next-line import/no-namespace -- type-only namespace import mirrors @visulima/connect's `z.ZodObject<any>` generic bound
import type * as z from "zod";

import type { ErrorHandlers } from "../error-handler/types";
import type { Serializers } from "../serializers";
import { onError, onNoMatch } from "./handler";
import httpHeaderNormalizerMiddleware from "./middleware/http-header-normalizer";
import serializersMiddleware from "./middleware/serializers-middleware";

const createNodeRouter = <
    Request extends IncomingMessage,
    Response extends ServerResponse,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ZodObject requires `any` for generic parameter compatibility, matching @visulima/connect
    Schema extends z.ZodObject<any> = z.ZodObject<{ body?: z.ZodObject<any>; headers?: z.ZodObject<any>; query?: z.ZodObject<any> }>,
>(
    options: {
        errorHandlers?: ErrorHandlers;
        middlewares?: {
            "http-header-normalizer"?: { canonical?: boolean; normalizeHeaderKey?: (key: string, canonical: boolean) => string };
            serializers?: {
                defaultContentType?: string;
                serializers?: Serializers;
            };
        };
        showTrace?: boolean;
    } = {},
): NodeRouter<Request, Response, Schema> => {
    const router = new NodeRouter<Request, Response, Schema>({
        onError: onError(options.errorHandlers ?? [], options.showTrace ?? false),
        onNoMatch,
    });

    return router
        .use(httpHeaderNormalizerMiddleware(options.middlewares?.["http-header-normalizer"] ?? {}))
        .use(
            serializersMiddleware(
                options.middlewares?.serializers?.serializers ?? [],
                options.middlewares?.serializers?.defaultContentType ?? "application/json; charset=utf-8",
            ),
        );
};

export default createNodeRouter;
