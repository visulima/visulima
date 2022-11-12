import merge from "lodash.merge";
// eslint-disable-next-line unicorn/prevent-abbreviations
import type { GetStaticProps } from "next";
import type { OAS3Definition, Tag } from "swagger-jsdoc";
// eslint-disable-next-line unicorn/prevent-abbreviations
import type { ModelsToOpenApiParameters } from "@visulima/crud";
// eslint-disable-next-line unicorn/prevent-abbreviations
import { modelsToOpenApi } from "@visulima/crud";
import debug from "debug";

import extendSwaggerSpec from "../../../../swagger/extend-swagger-spec";

const swaggerDebug = debug("visulima:api-platform:swagger:get-static-properties-swagger");
const swaggerCrudDebug = debug("visulima:api-platform:swagger:crud:get-static-properties-swagger");

// eslint-disable-next-line unicorn/consistent-function-scoping
const getStaticProps: (
    swaggerUrl: string,
    options?: {
        crud: ModelsToOpenApiParameters;
    },
) => GetStaticProps =
    (swaggerUrl, options) =>
    async (): Promise<{
        props: {
            swaggerUrl: string;
            swaggerData: OAS3Definition;
        };
    }> => {
        // eslint-disable-next-line compat/compat
        const response = await fetch(swaggerUrl);
        const swaggerData = await response.json();

        swaggerDebug(swaggerData);

        let crudSwagger: Partial<OAS3Definition> = {};

        if (typeof options?.crud !== "undefined") {
            try {
                const modelsOpenApi = await modelsToOpenApi(options?.crud);

                crudSwagger = {
                    components: { schemas: modelsOpenApi.schemas, examples: modelsOpenApi.examples },
                    tags: modelsOpenApi.tags as Tag[],
                    paths: modelsOpenApi.paths,
                };

                crudSwagger = extendSwaggerSpec(crudSwagger, {
                    "application/json": true,
                    "application/vnd.api+json": true,
                    "application/x-yaml": true,
                    "application/xml": true,
                    "text/csv": true,
                    "text/html": true,
                    "text/xml": true,
                });

                swaggerCrudDebug(JSON.stringify(crudSwagger, null, 2));
            } catch (e) {
                console.log(e);
                throw new Error("Please install @visulima/crud to use the crud swagger generator.");
            }
        }

        return {
            props: {
                swaggerUrl,
                swaggerData: JSON.parse(JSON.stringify(merge(swaggerData, crudSwagger))),
            },
        };
    };

export default getStaticProps;
