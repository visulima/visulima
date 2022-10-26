import { NextHandler } from "@visulima/connect";
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

// eslint-disable-next-line max-len
const serialize = <Request extends IncomingMessage, Response extends ServerResponse>(
    serializers: Serializers,
    request: Request,
    response: Response | NextApiResponse,
    data: any,
    // eslint-disable-next-line radar/cognitive-complexity
) => {
    const apiFormat = response.getHeader("content-type");

    if (typeof apiFormat === "string") {
        let serializedData = data;
        let skipDefaultSerializer = false;

        // eslint-disable-next-line no-restricted-syntax
        for (const { regex, serializer } of serializers) {
            if (regex.test(apiFormat)) {
                serializedData = serializer(serializedData);
                skipDefaultSerializer = true;
                break;
            }
        }

        if (!skipDefaultSerializer) {
            if (/yaml|yml/.test(apiFormat)) {
                serializedData = yamlTransformer(hasJsonStructure(data) ? JSON.parse(data) : data);
            } else if (["application/xml", "text/xml"].includes(apiFormat)) {
                serializedData = xmlTransformer(
                    hasJsonStructure(data)
                        ? {
                            _name: headerCase(`${request.url?.replace("/", "")}`.trim()),
                            _content: JSON.parse(data),
                        }
                        : data,
                );
            }
        }

        response.setHeader("Content-Type", apiFormat);

        // eslint-disable-next-line no-param-reassign
        return serializedData;
    }

    return data;
};

const serializersMiddleware = (serializers: Serializers = []) => async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response | NextApiResponse, next: NextHandler) => {
    if (typeof (response as NextApiResponse)?.send === "function") {
        const oldSend = (response as NextApiResponse).send;

        // @ts-ignore
        (response as NextApiResponse).send = (data) => {
            (response as NextApiResponse).send = oldSend;

            // eslint-disable-next-line no-param-reassign
            data = serialize<Request, Response>(serializers, request, response, data);

            // @ts-ignore
            return (response as NextApiResponse).send(data);
        };
    } else {
        const oldEnd = response.end;

        // @ts-ignore
        response.end = (data, ...arguments_) => {
            response.end = oldEnd;

            // eslint-disable-next-line no-param-reassign
            data = serialize<Request, Response>(serializers, request, response, data);

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
