// eslint-disable-next-line import/no-extraneous-dependencies
import dynamic from "next/dynamic";
// eslint-disable-next-line import/no-extraneous-dependencies
import Head from "next/head";
import type { InferGetStaticPropsType, NextPage } from "next/types";
import type { SwaggerUIProps } from "swagger-ui-react";

import type getStaticProps from "../get-static-properties-openapi";
// eslint-disable-next-line import/no-extraneous-dependencies
const SwaggerUi = dynamic(async () => await import("swagger-ui-react"), { ssr: false });

const SwaggerApiDocument: (name: string, swagger?: Exclude<SwaggerUIProps, "spec">) => NextPage<InferGetStaticPropsType<typeof getStaticProps>> =
    (name, swagger = {}) =>
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
            <SwaggerUi {...swagger} spec={openapiData} />
        </>
    );

export default SwaggerApiDocument;
