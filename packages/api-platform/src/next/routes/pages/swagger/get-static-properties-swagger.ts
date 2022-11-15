// eslint-disable-next-line unicorn/prevent-abbreviations
import debug from "debug";
import type { GetStaticProps } from "next";
import type { OAS3Definition } from "swagger-jsdoc";

// eslint-disable-next-line testing-library/no-debugging-utils
const swaggerDebug = debug("visulima:api-platform:swagger:get-static-properties-swagger");

// eslint-disable-next-line unicorn/consistent-function-scoping
const getStaticProps: (
    swaggerUrl: string,
) => GetStaticProps = (swaggerUrl) => async (): Promise<{
    props: {
        swaggerUrl: string;
        swaggerData: OAS3Definition;
    };
}> => {
    // eslint-disable-next-line compat/compat
    const response = await fetch(swaggerUrl);
    const swaggerData = await response.json();

    swaggerDebug(swaggerData);

    return {
        props: {
            swaggerUrl,
            swaggerData: JSON.parse(JSON.stringify(swaggerData)),
        },
    };
};

export default getStaticProps;
