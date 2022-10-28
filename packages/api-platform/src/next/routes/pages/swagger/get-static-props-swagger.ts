// eslint-disable-next-line unicorn/prevent-abbreviations
import type { GetStaticProps } from "next";

// eslint-disable-next-line unicorn/consistent-function-scoping
const getStaticProps: (swaggerUrl: string) => GetStaticProps = (swaggerUrl) => async () => {
    // eslint-disable-next-line compat/compat
    const response = await fetch(swaggerUrl);
    const swaggerData = await response.json();

    return {
        props: {
            swaggerUrl,
            swaggerData,
        },
    };
};

export default getStaticProps;
