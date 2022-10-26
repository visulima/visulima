import _debug from "debug";
import merge from "lodash.merge";
import path from "node:path";
import type { Options } from "swagger-jsdoc";
import swaggerJsdoc from "swagger-jsdoc";

import type { SwaggerOptions } from "./types";

const debug = _debug("visulima:api-platform:swagger:create-swagger-spec");

const API_FOLDERS = ["app/pages/api/**", "pages/api/**"];
const openapiVersion = "3.0.3";

export default function createSwaggerSpec({ apiFolders = API_FOLDERS, options: swaggerOptions }: SwaggerOptions) {
    const folders: string[] = []; // files containing annotations as above

    apiFolders.forEach((folder) => {
        const apiDirectory = path.join(process.cwd(), folder);

        folders.push(`${apiDirectory}/*.js`, `${apiDirectory}/*.ts`);
    });

    // eslint-disable-next-line testing-library/no-debugging-utils
    debug(`Folders used to find swagger js docs ${folders.join(", ")}`);

    const options = {
        definition: {
            openapi: openapiVersion,
        },
        swaggerDefinition: {
            openapi: openapiVersion,
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                    },
                    apiKeyAuth: {
                        type: "apiKey",
                        in: "header",
                        name: "X-API-KEY",
                    },
                },
                schemas: {
                    Error: {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                            },
                            title: {
                                type: "string",
                            },
                            details: {
                                type: "string",
                            },
                        },
                    },
                },
            },
            security: [
                {
                    apiKeyAuth: [],
                    bearerAuth: [],
                },
            ],
        },
        apis: folders,
    };

    if (swaggerOptions.definition?.openapi?.split(".")[0] === "2" || swaggerOptions.swaggerDefinition?.openapi?.split(".")[0] === "3") {
        throw new Error("Swagger definition version must be >= 3.0");
    }

    return swaggerJsdoc(merge(options, swaggerOptions) as Options);
}
