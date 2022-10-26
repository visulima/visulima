import merge from "lodash.merge";
import type { NextApiRequest, NextApiResponse } from "next";
import path from 'path';
import { promises as fs } from 'fs';

import createRouter from "../../../connect/create-router";
import yamlTransformer from "../../../serializers/yaml";
import extendSwaggerSpec from "../../../swagger/extend-swagger-spec";
import type { OpenAPI3, SwaggerOptions } from "../../../swagger/types";

// eslint-disable-next-line max-len
const swaggerApiRoute = (title: string, version: string, options: Partial<SwaggerOptions> & Partial<{ mediaTypes: {} }> = {}) => {
    const router = createRouter<NextApiRequest, NextApiResponse>().get(async (request, response) => {
        const { mediaTypes, swaggerDefinition } = options;

        const allowedMediaTypes = merge(
            {
                "application/json": true,
                "application/vnd.api+json": true,
                "application/x-yaml": true,
                "application/xml": true,
                "text/csv": true,
                "text/html": true,
                "text/xml": true,
            },
            mediaTypes,
        );

        const jsonDirectory = path.join(process.cwd(), 'static');
        const fileContents = await fs.readFile(jsonDirectory + '/data.json', 'utf8');

        const spec = extendSwaggerSpec(
            JSON.parse(fileContents) as OpenAPI3,
            {
                swaggerDefinition: merge(
                    {
                        info: {
                            title,
                            version,
                        },
                        schemes: ["http", "https"],
                        host: `${process.env.NEXT_PUBLIC_APP_ORIGIN}`,
                        basePath: "/",
                    },
                    swaggerDefinition,
                ),
                allowedMediaTypes,
            },
        ) as OpenAPI3;

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
