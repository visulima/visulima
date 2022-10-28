import merge from "lodash.merge";
import type { NextApiRequest, NextApiResponse } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import createRouter from "../../../connect/create-router";
import yamlTransformer from "../../../serializers/yaml";
import extendSwaggerSpec from "../../../swagger/extend-swagger-spec";
import type { OpenAPI3, SwaggerOptions } from "../../../swagger/types";

const defaultMediaTypes = {
    "application/json": true,
    "application/vnd.api+json": true,
    "application/x-yaml": true,
    "application/xml": true,
    "text/csv": true,
    "text/html": true,
    "text/xml": true,
};

// eslint-disable-next-line max-len
const swaggerApiRoute = (
    options: Partial<SwaggerOptions> &
    Partial<{
        mediaTypes: { [key: string]: boolean };
        swaggerFilePath: string;
    }> = {},
) => {
    const router = createRouter<NextApiRequest, NextApiResponse>().get(async (request, response) => {
        const { mediaTypes = defaultMediaTypes, swaggerDefinition, swaggerFilePath } = options;

        const swaggerPath = path.join(process.cwd(), swaggerFilePath || "swagger/swagger.json");

        if (!existsSync(swaggerPath)) {
            throw new Error(`Swagger file not found at ${swaggerPath}. Did you change the output path in "withOpenApi" inside the next.config.js file?`);
        }

        const fileContents = readFileSync(swaggerPath, "utf8");

        const spec = extendSwaggerSpec(JSON.parse(fileContents) as OpenAPI3, {
            swaggerDefinition: merge(
                {
                    schemes: ["http", "https"],
                    host: `${process.env.NEXT_PUBLIC_APP_ORIGIN}`,
                    basePath: "/",
                },
                swaggerDefinition,
            ),
            allowedMediaTypes: mediaTypes,
        }) as OpenAPI3;

        if (typeof request.headers.accept === "string" && /yaml|yml/.test(request.headers.accept)) {
            response.setHeader("Content-Type", request.headers.accept);
            response.status(200).send(yamlTransformer(spec));
        } else {
            response.setHeader("Content-Type", "application/json");
            response.status(200).json(spec);
        }
    });

    return router.handler();
};

export default swaggerApiRoute;
