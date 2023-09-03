import debug from "debug";
// eslint-disable-next-line no-restricted-imports
import merge from "lodash.merge";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenAPIV3 } from "openapi-types";

import yamlTransformer from "../../serializers/transformer/yaml";
import extendSwaggerSpec from "../extend-swagger-spec";

const swaggerCrudDebug = debug("visulima:api-platform:swagger:get-static-properties-swagger");

const swaggerHandler =
    (
        // eslint-disable-next-line unicorn/no-object-as-default-parameter
        allowedMediaTypes: Record<string, boolean> = {
            "application/json": true,
        },
        specs: Partial<OpenAPIV3.Document>[] = [],
    ): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) =>
    async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response) => {
        let spec: Partial<OpenAPIV3.Document> = {};

        specs.forEach((oas) => {
            swaggerCrudDebug(JSON.stringify(oas, null, 2));
            spec = merge(spec, extendSwaggerSpec(oas, allowedMediaTypes));
        });

        let data: Buffer | Uint8Array | string;

        if (typeof request.headers.accept === "string" && /yaml|yml/.test(request.headers.accept)) {
            response.setHeader("Content-Type", request.headers.accept);

            data = yamlTransformer(spec);
        } else {
            response.setHeader("Content-Type", "application/json");

            data = JSON.stringify(spec, null, 2);
        }

        response.statusCode = 200;
        response.end(data);
    };

export default swaggerHandler;
