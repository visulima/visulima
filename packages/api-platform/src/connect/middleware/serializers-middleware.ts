import type { NextHandler } from "@visulima/connect";
import type { NextApiResponse } from "next";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { Serializers } from "../../serializers";
import { serialize } from "../../serializers";

// eslint-disable-next-line max-len
const serializersMiddleware = (serializers: Serializers = [], defaultContentType: string = "application/json; charset=utf-8") => async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response | NextApiResponse, next: NextHandler) => {
    if (typeof (response as NextApiResponse)?.send === "function") {
        const oldSend = (response as NextApiResponse).send;

        (response as NextApiResponse).send = (data) => {
            (response as NextApiResponse).send = oldSend;

            // eslint-disable-next-line no-param-reassign
            data = serialize<Request, Response | NextApiResponse>(serializers, request, response, data, { defaultContentType });

            return (response as NextApiResponse).send(data);
        };
    } else {
        const oldEnd = response.end;

        // @ts-ignore
        response.end = (data, ...arguments_) => {
            response.end = oldEnd;

            // eslint-disable-next-line no-param-reassign
            data = serialize<Request, Response | NextApiResponse>(serializers, request, response, data, { defaultContentType });

            // @ts-ignore
            return response.end(data, ...arguments_);
        };
    }

    return next();
};

export default serializersMiddleware;
