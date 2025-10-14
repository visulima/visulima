import type { IncomingMessage, ServerResponse } from "node:http";

import type { NextHandler, ValueOrPromise } from "@visulima/connect";
import debug from "debug";
import type { NextApiResponse } from "next/types";

import type { Serializers } from "../../serializers";
import { serialize } from "../../serializers";

const log = debug("api-platform:connect:serializers-middleware");

const serializersMiddleware
    = (serializers: Serializers = [], defaultContentType = "application/json; charset=utf-8") =>
        async <Request extends IncomingMessage, Response extends ServerResponse>(
            request: Request,
            response: NextApiResponse | Response,
            next: NextHandler,
        ): Promise<ValueOrPromise<void>> => {
            if (typeof (response as NextApiResponse).send === "function") {
                const oldSend = (response as NextApiResponse).send;

                (response as NextApiResponse).send = (data) => {
                    (response as NextApiResponse).send = oldSend;

                    // eslint-disable-next-line no-param-reassign
                    data = serialize<Request, NextApiResponse | Response>(serializers, request, response, data, { defaultContentType });

                    (response as NextApiResponse).send(data);
                };
            } else if (typeof (response as NextApiResponse).json === "function") {
                log("response.json() is not supported by @visulima/api-platform serializer. Use response.send() or response.end() instead.");
            } else {
                const oldEnd = response.end;

                // @ts-expect-error TS2322: Type
                (response as Response).end = (data, ...arguments_) => {
                    response.end = oldEnd;

                    // eslint-disable-next-line no-param-reassign
                    data = serialize<Request, NextApiResponse | Response>(serializers, request, response, data, { defaultContentType });

                    // @ts-expect-error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'BufferEncoding'.
                    return response.end(data, ...arguments_);
                };
            }

            return next();
        };

export default serializersMiddleware;
