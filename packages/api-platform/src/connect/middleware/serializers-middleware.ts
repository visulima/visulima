import type { NextHandler } from "@visulima/connect";
import accepts from "accepts";
import { header as headerCase } from "case";
import type { NextApiResponse } from "next";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { Serializer } from "../serializers/types";
import xmlTransformer from "../serializers/xml";
import yamlTransformer from "../serializers/yaml";

function hasJsonStructure(string_: any): boolean {
    if (typeof string_ !== "string") {
        return false;
    }

    try {
        const result = JSON.parse(string_);
        const type = Object.prototype.toString.call(result);

        return type === "[object Object]" || type === "[object Array]";
    } catch {
        return false;
    }
}

const contentTypeKey = "Content-Type";

// eslint-disable-next-line max-len
const serialize = <Request extends IncomingMessage, Response extends ServerResponse>(
    serializers: Serializers,
    request: Request,
    response: Response | NextApiResponse,
    data: any,
    options: {
        defaultContentType: string;
    },
    // eslint-disable-next-line radar/cognitive-complexity
) => {
    const contentType = response.getHeader(contentTypeKey) as string | undefined;

    // skip serialization when Content-Type is already set
    if (typeof contentType === "string") {
        return data;
    }

    const accept = accepts(request);
    const types: string[] = [...(accept.types() as string[]), options.defaultContentType];

    let serializedData = data;

    // eslint-disable-next-line no-restricted-syntax
    types.every((type) => {
        let breakTypes = false;

        serializers.forEach(({ regex, serializer }) => {
            if (!regex.test(type)) {
                return;
            }

            response.setHeader(contentTypeKey, type);
            serializedData = serializer(serializedData);
            breakTypes = true;
        });

        if (!breakTypes) {
            if (/yaml|yml/.test(type)) {
                response.setHeader(contentTypeKey, type);

                serializedData = yamlTransformer(hasJsonStructure(data) ? JSON.parse(data) : data);
            } else if (/xml/.test(type)) {
                response.setHeader(contentTypeKey, type);

                serializedData = xmlTransformer({
                    [headerCase(`${request.url?.replace("/api/", "")}`.trim())]: hasJsonStructure(data) ? JSON.parse(data) : data,
                });
            }
        }

        return breakTypes;
    });

    // eslint-disable-next-line no-param-reassign
    return serializedData;
};

// eslint-disable-next-line max-len
const serializersMiddleware = (serializers: Serializers = [], defaultContentType: string = "application/json; charset=utf-8") => async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response | NextApiResponse, next: NextHandler) => {
    if (typeof (response as NextApiResponse)?.send === "function") {
        const oldSend = (response as NextApiResponse).send;

        (response as NextApiResponse).send = (data) => {
            (response as NextApiResponse).send = oldSend;

            // eslint-disable-next-line no-param-reassign
            data = serialize<Request, Response>(serializers, request, response, data, { defaultContentType });

            return (response as NextApiResponse).send(data);
        };
    } else {
        const oldEnd = response.end;

        // @ts-ignore
        response.end = (data, ...arguments_) => {
            response.end = oldEnd;

            // eslint-disable-next-line no-param-reassign
            data = serialize<Request, Response>(serializers, request, response, data, { defaultContentType });

            // @ts-ignore
            return response.end(data, ...arguments_);
        };
    }

    return next();
};

export type Serializers = {
    regex: RegExp;
    serializer: Serializer;
}[];
export default serializersMiddleware;
