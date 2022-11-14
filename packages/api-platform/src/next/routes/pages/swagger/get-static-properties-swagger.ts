// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import type { ModelsToOpenApiParameters } from "@visulima/crud";
// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import { modelsToOpenApi } from "@visulima/crud";
import debug from "debug";
import merge from "lodash.merge";
// eslint-disable-next-line unicorn/prevent-abbreviations
import type { GetStaticProps } from "next";
import type { OAS3Definition, Tag } from "swagger-jsdoc";

import extendSwaggerSpec from "../../../../swagger/extend-swagger-spec";

// eslint-disable-next-line testing-library/no-debugging-utils
const swaggerDebug = debug("visulima:api-platform:swagger:get-static-properties-swagger");
// eslint-disable-next-line testing-library/no-debugging-utils
const swaggerCrudDebug = debug("visulima:api-platform:swagger:crud:get-static-properties-swagger");

// eslint-disable-next-line unicorn/consistent-function-scoping
const getStaticProps: (
    swaggerUrl: string,
    options?: {
        crud: ModelsToOpenApiParameters;
    },
) => GetStaticProps = (swaggerUrl, options) => async (): Promise<{
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

            crudSwagger = extendSwaggerSpec(crudSwagger, options?.crud?.swagger?.allowedMediaTypes || { "application/json": true });

            swaggerCrudDebug(JSON.stringify(crudSwagger, null, 2));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(error);
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
