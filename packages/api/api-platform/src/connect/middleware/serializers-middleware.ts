import type { IncomingMessage, ServerResponse } from "node:http";

import type { NextHandler, ValueOrPromise } from "@visulima/connect";
// eslint-disable-next-line e18e/ban-dependencies -- debug is a stable runtime dep of the connect serializer middleware; migrating to obug is tracked separately
import debug from "debug";
import type { NextApiResponse } from "next/types";

import type { Serializers } from "../../serializers";
import { serialize } from "../../serializers";

const log = debug("api-platform:connect:serializers-middleware");

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- Request/Response generics flow into the returned function so callers retain their concrete types */
const serializersMiddleware =
    (
        serializers: Serializers = [],
        defaultContentType: string = "application/json; charset=utf-8",
    ): (<Request extends IncomingMessage, Response extends ServerResponse>(
        request: Request,
        response: NextApiResponse | Response,
        next: NextHandler,
    ) => Promise<ValueOrPromise<void>>) =>
    async <Request extends IncomingMessage, Response extends ServerResponse>(
        request: Request,
        response: NextApiResponse | Response,
        next: NextHandler,
    ): Promise<ValueOrPromise<void>> => {
        if (typeof (response as NextApiResponse).send === "function") {
            const oldSend: NextApiResponse["send"] = (response as NextApiResponse).send;

            (response as NextApiResponse).send = (data) => {
                (response as NextApiResponse).send = oldSend;

                // eslint-disable-next-line no-param-reassign
                data = serialize(serializers, request, response, data, { defaultContentType });

                (response as NextApiResponse).send(data);
            };
        } else if (typeof (response as NextApiResponse).json === "function") {
            log("response.json() is not supported by @visulima/api-platform serializer. Use response.send() or response.end() instead.");
        } else {
            // eslint-disable-next-line @typescript-eslint/unbound-method -- captured to restore original response.end after one-shot interception
            const oldEnd = response.end;

            // @ts-expect-error TS2322: Type
            (response as Response).end = (data, ...arguments_) => {
                response.end = oldEnd;

                // eslint-disable-next-line no-param-reassign
                data = serialize(serializers, request, response, data, { defaultContentType });

                // @ts-expect-error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'BufferEncoding'.
                return response.end(data, ...arguments_);
            };
        }

        await next();
    };
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

export default serializersMiddleware;
