import type { InferGetStaticPropsType, NextPage } from "next/types";
// eslint-disable-next-line import/no-extraneous-dependencies
import Head from "next/head";
// eslint-disable-next-line import/no-extraneous-dependencies
import { RedocStandalone } from "redoc";

import type getStaticProps from "../get-static-properties-swagger";

const RedocApiDocument: (
    name: string,
    swagger?: Exclude<
        {
            specUrl?: string;
        },
        "spec"
    >,
) => NextPage<InferGetStaticPropsType<typeof getStaticProps>> =
    (name, swagger = {}) =>
    ({ swaggerData }: InferGetStaticPropsType<typeof getStaticProps>) => (
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
            <RedocStandalone {...swagger} spec={swaggerData} />
        </>
    );

export default RedocApiDocument;
