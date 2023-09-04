import Head from "next/head";
import type { InferGetStaticPropsType, NextPage } from "next/types";
import { RedocStandalone } from "redoc";

import type getStaticProps from "../get-static-properties-openapi";

const RedocApiDocument: (
    name: string,
    options?: Exclude<
        {
            specUrl?: string;
        },
        "spec"
    >,
) => NextPage<InferGetStaticPropsType<typeof getStaticProps>> =
    (name, options) =>
    ({ openapiData }: InferGetStaticPropsType<typeof getStaticProps>) => (
        <>
            <Head>
                <title>{name}</title>
                <style>
                    {`
body {
    background: #fafafa !important;
}
`}
                </style>
            </Head>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <RedocStandalone {...options} spec={openapiData} />
        </>
    );

export default RedocApiDocument;
