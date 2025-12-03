import type { IncomingMessage, ServerResponse } from "node:http";

import accepts from "accepts";

import { toHeaderCase } from "../utils";
import hasJsonStructure from "./has-json-structure";
import xmlTransformer from "./transformer/xml";
import yamlTransformer from "./transformer/yaml";
import type { Serializers } from "./types";

const contentTypeKey = "Content-Type";

const serialize = <Request extends IncomingMessage, Response extends ServerResponse>(
    serializers: Serializers,
    request: Request,
    response: Response,
    data: unknown,
    options: {
        defaultContentType: string;
    },
): Buffer | Uint8Array | string => {
    const contentType = response.getHeader(contentTypeKey) as string | undefined;

    // skip serialization when Content-Type is already set
    if (typeof contentType === "string") {
        return data as string;
    }

    const accept = accepts(request);
    const types: string[] = [...(accept.types() as string[]), options.defaultContentType];

    let serializedData = data;
    let breakTypes = false;

    types.forEach((type) => {
        serializers.forEach(({ regex, serializer }) => {
            if (regex.test(type)) {
                response.setHeader(contentTypeKey, type);

                serializedData = serializer(serializedData);
                breakTypes = true;
            }
        });

        if (!breakTypes) {
            if (/yaml|yml/.test(type)) {
                response.setHeader(contentTypeKey, type);

                serializedData = yamlTransformer(hasJsonStructure(data) ? JSON.parse(data as string) : data);
            } else if (type.includes("xml")) {
                response.setHeader(contentTypeKey, type);

                serializedData = xmlTransformer({
                    [toHeaderCase(`${request.url?.replace("/api/", "")}`.trim())]: hasJsonStructure(data) ? JSON.parse(data as string) : data,
                });
            }
        }
    });

    return serializedData as Buffer | Uint8Array | string;
};

export default serialize;
