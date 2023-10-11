import type { IncomingMessage, ServerResponse } from "node:http";

import { NodeRouter } from "@visulima/connect";
import type { AnyZodObject, ZodObject } from "zod";

import type { ErrorHandlers } from "../error-handler/types";
import type { Serializers } from "../serializers";
import { onError, onNoMatch } from "./handler";
import httpHeaderNormalizerMiddleware from "./middleware/http-header-normalizer";
import serializersMiddleware from "./middleware/serializers-middleware";

const createNodeRouter = <
    Request extends IncomingMessage,
    Response extends ServerResponse,
    Schema extends AnyZodObject = ZodObject<{ body?: AnyZodObject; headers?: AnyZodObject; query?: AnyZodObject }>,
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
