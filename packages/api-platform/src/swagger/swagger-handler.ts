// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import type { ModelsToOpenApiParameters, SwaggerModelsConfig } from "@visulima/crud";
// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import { modelsToOpenApi } from "@visulima/crud";
import debug from "debug";
import merge from "lodash.merge";
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { OAS3Definition, Tag } from "swagger-jsdoc";

import yamlTransformer from "../connect/serializers/yaml";
import extendSwaggerSpec from "./extend-swagger-spec";

// eslint-disable-next-line testing-library/no-debugging-utils
const swaggerCrudDebug = debug("visulima:api-platform:swagger:crud:get-static-properties-swagger");

const swaggerHandler = (
    options: Partial<{
        allowedMediaTypes: { [key: string]: boolean };
        swaggerFilePath: string;
        crud: Exclude<ModelsToOpenApiParameters, "swagger"> & {
            swagger?: {
                models?: SwaggerModelsConfig<string>;
            };
        };
    }> = {},
) => {
    const {
        allowedMediaTypes = {
            "application/json": true,
        },
        swaggerFilePath,
        crud,
    } = options;

    return async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response) => {
        const swaggerPath = path.join(process.cwd(), swaggerFilePath || "swagger/swagger.json");

        if (!existsSync(swaggerPath)) {
            throw new Error(`Swagger file not found at ${swaggerPath}. Did you change the output path in "withOpenApi" inside the next.config.js file?`);
        }

        const fileContents = readFileSync(swaggerPath, "utf8");

        let spec = extendSwaggerSpec(JSON.parse(fileContents) as OAS3Definition, allowedMediaTypes) as OAS3Definition;
        let crudSwagger: Partial<OAS3Definition> = {};

        if (typeof crud !== "undefined") {
            try {
                const modelsOpenApi = await modelsToOpenApi(crud);

                crudSwagger = {
                    components: { schemas: modelsOpenApi.schemas, examples: modelsOpenApi.examples },
                    tags: modelsOpenApi.tags as Tag[],
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

        if (typeof request.headers.accept === "string" && /yaml|yml/.test(request.headers.accept)) {
            response.statusCode = 200;
            response.setHeader("Content-Type", request.headers.accept);
            response.end(yamlTransformer(spec));
        } else {
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(spec, null, 2));
        }
    };
};

export default swaggerHandler;
