// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import type { ModelsToOpenApiParameters, SwaggerModelsConfig } from "@visulima/crud";
// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import { modelsToOpenApi } from "@visulima/crud";
import debug from "debug";
import merge from "lodash.merge";
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { OpenAPIV3 } from "openapi-types";

import yamlTransformer from "../../serializers/transformer/yaml";
import extendSwaggerSpec from "../extend-swagger-spec";

// eslint-disable-next-line testing-library/no-debugging-utils
const swaggerCrudDebug = debug("visulima:api-platform:swagger:crud:get-static-properties-swagger");

const swaggerHandler = <M extends string, PrismaClient>(options: Partial<SwaggerHandlerOptions<M, PrismaClient>> = {}): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
    const {
        allowedMediaTypes = {
            "application/json": true,
        },
        swaggerFilePath,
        crud,
        specs,
    } = options;

    return async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response) => {
        const swaggerPath = path.join(process.cwd(), swaggerFilePath ?? "swagger/swagger.json");

        if (!existsSync(swaggerPath)) {
            throw new Error(`Swagger file not found at "${swaggerPath}".`);
        }

        const fileContents = readFileSync(swaggerPath, "utf8");

        let spec = extendSwaggerSpec(JSON.parse(fileContents) as OpenAPIV3.Document, allowedMediaTypes) as OpenAPIV3.Document;
        let crudSwagger: Partial<OpenAPIV3.Document> = {};

        if (crud !== undefined) {
            try {
                const modelsOpenApi = await modelsToOpenApi(crud);

                crudSwagger = {
                    components: { schemas: modelsOpenApi.schemas, examples: modelsOpenApi.examples },
                    tags: modelsOpenApi.tags,
                    paths: modelsOpenApi.paths,
                };

                crudSwagger = extendSwaggerSpec(crudSwagger, allowedMediaTypes);

                swaggerCrudDebug(JSON.stringify(crudSwagger, null, 2));

                spec = merge(spec, crudSwagger);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log(error);

                throw new Error("Please install @visulima/crud to use the crud swagger generator.");
            }
        }

        if (Array.isArray(specs)) {
            specs.forEach((value) => {
                spec = merge(spec, extendSwaggerSpec(value, allowedMediaTypes));
            });
        }

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
};

export type SwaggerHandlerOptions<M extends string, PrismaClient> = {
    allowedMediaTypes: { [key: string]: boolean };
    swaggerFilePath: string;
    crud: Exclude<ModelsToOpenApiParameters<M, PrismaClient>, "swagger"> & {
        swagger?: {
            models?: SwaggerModelsConfig<M>;
        };
    };
    specs?: Partial<OpenAPIV3.Document>[];
};

export default swaggerHandler;
