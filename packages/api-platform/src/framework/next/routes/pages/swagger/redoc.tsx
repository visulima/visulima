// eslint-disable-next-line import/no-extraneous-dependencies
import type { InferGetStaticPropsType, NextPage } from "next";
// eslint-disable-next-line import/no-extraneous-dependencies
import Head from "next/head";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { RedocStandaloneProps } from "redoc";
// eslint-disable-next-line import/no-extraneous-dependencies
import { RedocStandalone } from "redoc";

import type getStaticProps from "./get-static-properties-swagger";

// eslint-disable-next-line max-len
const RedocApiDocument: (
    name: string,
    swagger?: Exclude<RedocStandaloneProps, "spec">,
    // eslint-disable-next-line max-len,unicorn/no-useless-undefined
) => NextPage<InferGetStaticPropsType<typeof getStaticProps>> = (name, swagger = {}) => ({ swaggerData }: InferGetStaticPropsType<typeof getStaticProps>) => (
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
