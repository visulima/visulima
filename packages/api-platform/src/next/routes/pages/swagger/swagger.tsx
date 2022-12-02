import type { InferGetStaticPropsType, NextPage } from "next";
// eslint-disable-next-line import/no-extraneous-dependencies
import dynamic from "next/dynamic";
// eslint-disable-next-line import/no-extraneous-dependencies
import Head from "next/head";
// eslint-disable-next-line import/no-extraneous-dependencies
import React from "react";
import type { SwaggerUIProps } from "swagger-ui-react";

import getStaticProps from "./get-static-properties-swagger";
// eslint-disable-next-line import/no-extraneous-dependencies
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
dynamic(import("swagger-ui-react/swagger-ui.css"), { ssr: false });

// eslint-disable-next-line max-len
const SwaggerApiDocument: (
    name: string,
    swagger?: Exclude<SwaggerUIProps, "spec">,
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
                <SwaggerUI {...swagger} spec={swaggerData} />
            </>
);

export default SwaggerApiDocument;
