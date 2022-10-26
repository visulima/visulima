// eslint-disable-next-line unicorn/prevent-abbreviations
import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { GetStaticProps } from "next";

// eslint-disable-next-line unicorn/consistent-function-scoping
const getStaticProps: (swaggerUrl: string) => GetStaticProps = (swaggerUrl) => async () => {
    const queryClient = new QueryClient();

    // eslint-disable-next-line compat/compat
    await queryClient.prefetchQuery(["swagger_file"], async () => fetch(swaggerUrl).then((response) => response.json()));

    return {
        props: {
            dehydratedState: dehydrate(queryClient),
            swaggerUrl,
        },
    };
};

export default getStaticProps;
