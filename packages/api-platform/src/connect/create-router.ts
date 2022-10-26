import { NodeRouter } from "@visulima/connect";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnyZodObject } from "zod";
import { ZodObject } from "zod";

import httpHeaderNormalizerMiddleware from "../middleware/http-header-normalizer";
import type { Serializers } from "../middleware/serializers-middleware";
import serializersMiddleware from "../middleware/serializers-middleware";
import type { ErrorHandlers } from "../types";
import { onError, onNoMatch } from "./handler";

const createRouter = <
    Request extends IncomingMessage,
    Response extends ServerResponse,
    Schema extends AnyZodObject = ZodObject<{ body?: AnyZodObject; headers?: AnyZodObject; query?: AnyZodObject }>,
>(
        options: Partial<{
            "http-header-normalizer": { canonical?: boolean; normalizeHeaderKey?: (key: string, canonical: boolean) => string };
            serializers: Serializers;
            errorHandlers: ErrorHandlers;
        }> = {},
    ) => {
    const router = new NodeRouter<Request, Response, Schema>({
        onNoMatch,
        onError: onError(options.errorHandlers || []),
    });

    return router.use(httpHeaderNormalizerMiddleware(options["http-header-normalizer"] || {})).use(serializersMiddleware(options.serializers || []));
};

export default createRouter;
