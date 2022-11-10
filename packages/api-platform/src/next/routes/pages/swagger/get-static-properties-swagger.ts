import merge from "lodash.merge";
// eslint-disable-next-line unicorn/prevent-abbreviations
import type { GetStaticProps } from "next";
import type { OAS3Definition, Tag } from "swagger-jsdoc";
// eslint-disable-next-line unicorn/prevent-abbreviations
import type { ModelsToOpenApiParameters } from "@visulima/crud";
// eslint-disable-next-line unicorn/prevent-abbreviations
import { modelsToOpenApi } from "@visulima/crud";

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

        let crudSwagger: Partial<OAS3Definition> = {};

        if (typeof options?.crud !== "undefined") {
            try {
                const modelsOpenApi = await modelsToOpenApi(options?.crud);

                crudSwagger = { components: { schemas: modelsOpenApi.schemas }, tags: modelsOpenApi.tags as Tag[], paths: modelsOpenApi.paths };
            } catch (e) {
                throw new Error("Please install @visulima/crud to use the crud swagger generator.");
            }
        }

        return {
            props: {
                swaggerUrl,
                swaggerData: JSON.parse(
                    JSON.stringify(merge(swaggerData, crudSwagger)),
                ),
            },
        };
    };

export default getStaticProps;
