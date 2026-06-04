import type { IncomingMessage, ServerResponse } from "node:http";

import accepts from "accepts";

import { toHeaderCase } from "../utils";
import hasJsonStructure from "./has-json-structure";
import xmlTransformer from "./transformer/xml";
import yamlTransformer from "./transformer/yaml";
import type { Serializers } from "./types";

const contentTypeKey = "Content-Type";
const yamlTypeRegex = /yaml|yml/u;

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters, sonarjs/function-return-type -- Request/Response generics flow into call sites in connect/middleware/serializers-middleware; intentional Buffer | Uint8Array | string union for downstream content-type negotiation */
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

    for (const type of types) {
        for (const { regex, serializer } of serializers) {
            if (regex.test(type)) {
                response.setHeader(contentTypeKey, type);

                return serializer(data) as Buffer | Uint8Array | string;
            }
        }

        if (yamlTypeRegex.test(type)) {
            response.setHeader(contentTypeKey, type);

            return yamlTransformer(hasJsonStructure(data) ? JSON.parse(data as string) : data) as Buffer | Uint8Array | string;
        }

        if (type.includes("xml")) {
            response.setHeader(contentTypeKey, type);

            const xmlRootKey = toHeaderCase(String(request.url?.replace("/api/", "")).trim());

            return xmlTransformer({
                [xmlRootKey]: hasJsonStructure(data) ? JSON.parse(data as string) : data,
            }) as Buffer | Uint8Array | string;
        }
    }

    return data as Buffer | Uint8Array | string;
};
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters, sonarjs/function-return-type */

export default serialize;
