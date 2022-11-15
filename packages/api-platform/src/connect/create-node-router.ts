import { NodeRouter } from "@visulima/connect";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnyZodObject } from "zod";
import { ZodObject } from "zod";

import type { ErrorHandlers } from "../error-handler/types";
import { onError, onNoMatch } from "./handler";
import httpHeaderNormalizerMiddleware from "./middleware/http-header-normalizer";
import type { Serializers } from "./middleware/serializers-middleware";
import serializersMiddleware from "./middleware/serializers-middleware";

const createNodeRouter = <
    Request extends IncomingMessage,
    Response extends ServerResponse,
    Schema extends AnyZodObject = ZodObject<{ body?: AnyZodObject; headers?: AnyZodObject; query?: AnyZodObject }>,
>(
        options: {
            middlewares?: {
                "http-header-normalizer"?: { canonical?: boolean; normalizeHeaderKey?: (key: string, canonical: boolean) => string };
                serializers?: {
                    serializers?: Serializers;
                    defaultContentType?: string;
                };
            };
            errorHandlers?: ErrorHandlers;
            showTrace?: boolean;
        } = {},
    ) => {
    const router = new NodeRouter<Request, Response, Schema>({
        onNoMatch,
        onError: onError(options.errorHandlers || [], options.showTrace || false),
    });

    return router
        .use(httpHeaderNormalizerMiddleware(options?.middlewares?.["http-header-normalizer"] || {}))
        .use(
            serializersMiddleware(
                options?.middlewares?.serializers?.serializers || [],
                options?.middlewares?.serializers?.defaultContentType || "application/json; charset=utf-8",
            ),
        );
};

export default createNodeRouter;
