import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { ModelsToOpenApiParameters, SwaggerModelsConfig } from "@visulima/crud";
import { modelsToOpenApi } from "@visulima/crud";
import { join } from "@visulima/path";
// eslint-disable-next-line e18e/ban-dependencies -- debug is a stable runtime dep used for swagger crud preview tooling; obug migration tracked separately
import debug from "debug";
// eslint-disable-next-line no-restricted-imports, e18e/ban-dependencies -- lodash.merge is the established deep-merge utility for swagger spec extension; native alternatives lack equivalent semantics
import merge from "lodash.merge";
import type { OpenAPIV3 } from "openapi-types";

import yamlTransformer from "../../serializers/transformer/yaml";
import extendSwaggerSpec from "../extend-swagger-spec";

const swaggerCrudDebug = debug("visulima:api-platform:swagger:crud:get-static-properties-swagger");
const yamlAcceptRegex = /yaml|yml/u;

const swaggerHandler = <M extends string, PrismaClient>(
    options: Partial<SwaggerHandlerOptions<M, PrismaClient>> = {},
): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
    const {
        allowedMediaTypes = {
            "application/json": true,
        },
        crud,
        specs,
        swaggerFilePath,
    } = options;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Request/Response generics propagate to call sites in the connect/next router integrations
    return async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response) => {
        const swaggerPath = join(process.cwd(), swaggerFilePath ?? "swagger/swagger.json");

        if (!existsSync(swaggerPath)) {
            throw new Error(`Swagger file not found at "${swaggerPath}".`);
        }

        const fileContents = readFileSync(swaggerPath, "utf8");

        let spec = extendSwaggerSpec(JSON.parse(fileContents) as OpenAPIV3.Document, allowedMediaTypes) as OpenAPIV3.Document;

        if (crud !== undefined) {
            let crudSwagger: Partial<OpenAPIV3.Document>;

            try {
                const modelsOpenApi = await modelsToOpenApi(crud);

                crudSwagger = {
                    components: { examples: modelsOpenApi.examples, schemas: modelsOpenApi.schemas },
                    paths: modelsOpenApi.paths,
                    tags: modelsOpenApi.tags,
                };

                crudSwagger = extendSwaggerSpec(crudSwagger, allowedMediaTypes);

                // eslint-disable-next-line unicorn/no-null -- JSON.stringify replacer must be null to use the third indent argument
                swaggerCrudDebug(JSON.stringify(crudSwagger, null, 2));

                spec = merge(spec, crudSwagger);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log(error);

                throw new Error("Please install @visulima/crud to use the crud swagger generator.", { cause: error });
            }
        }

        if (Array.isArray(specs)) {
            specs.forEach((value) => {
                spec = merge(spec, extendSwaggerSpec(value, allowedMediaTypes));
            });
        }

        let data: Buffer | Uint8Array | string;

        if (typeof request.headers.accept === "string" && yamlAcceptRegex.test(request.headers.accept)) {
            response.setHeader("Content-Type", request.headers.accept);

            data = yamlTransformer(spec);
        } else {
            response.setHeader("Content-Type", "application/json");

            // eslint-disable-next-line unicorn/no-null -- JSON.stringify replacer must be null to use the third indent argument
            data = JSON.stringify(spec, null, 2);
        }

        response.statusCode = 200;
        response.end(data);
    };
};

export interface SwaggerHandlerOptions<M extends string, PrismaClient> {
    allowedMediaTypes: Record<string, boolean>;
    crud: Exclude<ModelsToOpenApiParameters<M, PrismaClient>, "swagger"> & {
        swagger?: {
            models?: SwaggerModelsConfig<M>;
        };
    };
    specs?: Partial<OpenAPIV3.Document>[];
    swaggerFilePath: string;
}

export default swaggerHandler;
