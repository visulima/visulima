// eslint-disable-next-line e18e/ban-dependencies -- debug is a stable runtime dep used for swagger preview tooling; obug migration tracked separately
import debug from "debug";
import type { GetStaticProps } from "next/types";
import type { OpenAPIV3 } from "openapi-types";

const swaggerDebug = debug("visulima:api-platform:swagger:get-static-properties-swagger");

const getStaticProps: (swaggerUrl: string) => GetStaticProps
    = (swaggerUrl) =>
        async (): Promise<{
            props: {
                swaggerData: OpenAPIV3.Document;
                swaggerUrl: string;
            };
        }> => {
            const response = await fetch(swaggerUrl);
            const swaggerData = (await response.json()) as OpenAPIV3.Document;

            swaggerDebug(swaggerData);

            return {
                props: {
                    swaggerData: structuredClone(swaggerData),
                    swaggerUrl,
                },
            };
        };

export default getStaticProps;
