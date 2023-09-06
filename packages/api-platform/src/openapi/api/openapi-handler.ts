import debug from "debug";
// eslint-disable-next-line no-restricted-imports
import merge from "lodash.merge";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenAPIV3 } from "openapi-types";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { cwd } from "node:process";
import accepts from "accepts";

import yamlTransformer from "../../serializers/transformer/yaml";
import extendOpenapiSpec from "../extend-openapi-spec";

const openapiDebug = debug("visulima:api-platform:openapi:handler");

interface OpenapiHandler {
    allowedMediaTypes?: Record<string, boolean>;
    openapiFilePath?: string;
    specs?: (Partial<OpenAPIV3.Document> | Promise<Partial<OpenAPIV3.Document>>)[];
}

const openapiHandler =
    ({
        allowedMediaTypes = {
            "application/json": true,
        },
        openapiFilePath = "swagger/swagger.json",
        specs = [],
    }: OpenapiHandler): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) =>
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response) => {
        const openapiPath = join(cwd(), openapiFilePath);

        if (existsSync(openapiPath)) {
            const fileContents = readFileSync(openapiPath, "utf8");

            specs.push(JSON.parse(fileContents) as OpenAPIV3.Document);
        } else {
            openapiDebug(`Swagger file not found at "${openapiPath}".`);
        }

        let spec: Partial<OpenAPIV3.Document> = {};

        // eslint-disable-next-line no-restricted-syntax
        for await (const oas of specs) {
            openapiDebug(JSON.stringify(oas, null, 2));

            spec = merge(
                spec,
                extendOpenapiSpec(
                    oas,
                    allowedMediaTypes ?? {
                        "application/json": true,
                    },
                ),
            );
        }

        let data: Buffer | Uint8Array | string | undefined;

        const accept = accepts(request);
        const types = accept.types();

        let type: string | undefined;

        if (Array.isArray(types) && types.length > 0) {
            types.forEach((rType) => {
                if (type) {
                    return;
                }

                if (rType === "application/json" || rType === "text/yaml" || rType === "text/yml") {
                    type = rType;
                }
            });
        }

        if (type !== undefined && /yaml|yml/.test(type)) {
            response.setHeader("Content-Type", type);

            data = yamlTransformer(spec);
        } else {
            response.setHeader("Content-Type", "application/json");

            data = JSON.stringify(spec, null, 2);
        }

        response.statusCode = 200;
        response.end(data);
    };

export default openapiHandler;
