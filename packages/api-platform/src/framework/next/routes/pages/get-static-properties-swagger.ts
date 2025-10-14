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
        // eslint-disable-next-line compat/compat
            const response = await fetch(swaggerUrl);
            const swaggerData = await response.json();

            swaggerDebug(swaggerData);

            return {
                props: {
                    swaggerData: JSON.parse(JSON.stringify(swaggerData)) as OpenAPIV3.Document,
                    swaggerUrl,
                },
            };
        };

export default getStaticProps;
