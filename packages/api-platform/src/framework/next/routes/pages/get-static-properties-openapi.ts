import debug from "debug";
import type { GetStaticProps } from "next/types";
import type { OpenAPIV3 } from "openapi-types";

const openapiDebug = debug("visulima:api-platform:openapi:get-static-properties-openapi");

const getStaticProps: (openapiUrl: string) => GetStaticProps =
    (openapiUrl) =>
    async (): Promise<{
        props: {
            openapiData: OpenAPIV3.Document;
            openapiUrl: string;
        };
    }> => {
        // eslint-disable-next-line compat/compat
        const response = await fetch(openapiUrl);
        const openapiData = await response.json();

        openapiDebug(openapiData);

        return {
            props: {
                openapiData: JSON.parse(JSON.stringify(openapiData)) as OpenAPIV3.Document,
                openapiUrl,
            },
        };
    };

export default getStaticProps;
