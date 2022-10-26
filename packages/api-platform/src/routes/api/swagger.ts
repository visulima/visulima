import merge from "lodash.merge";
import type { NextApiRequest, NextApiResponse } from "next";

import createRouter from "../../connect/create-router";
import yamlTransformer from "../../serializers/yaml";
import createSwaggerSpec from "../../swagger/create-swagger-spec";
import type { OpenAPI3, SwaggerOptions } from "../../swagger/types";

// eslint-disable-next-line max-len
const swaggerApiRoute = (title: string, version: string, options: Partial<SwaggerOptions> & Partial<{ mediaTypes: {} }> = {}) => {
    const router = createRouter<NextApiRequest, NextApiResponse>().get(async (request, response) => {
        const { mediaTypes, ...swaggerOptions } = options;

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

        const spec = createSwaggerSpec(
            merge(
                {
                    options: {
                        swaggerDefinition: {
                            info: {
                                title,
                                version,
                            },
                            schemes: ["http", "https"],
                            host: `${process.env.NEXT_PUBLIC_APP_ORIGIN}`,
                            basePath: "/",
                        },
                    },
                    allowedMediaTypes,
                },
                swaggerOptions,
            ),
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
