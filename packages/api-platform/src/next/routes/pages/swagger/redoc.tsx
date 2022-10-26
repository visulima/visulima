import { useQuery } from "@tanstack/react-query";
import type { InferGetStaticPropsType, NextPage } from "next";
// eslint-disable-next-line import/no-extraneous-dependencies
import Head from "next/head";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { ReactNode } from "react";
import React, { Suspense } from "react";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { RedocStandaloneProps } from "redoc";
// eslint-disable-next-line import/no-extraneous-dependencies
import { RedocStandalone } from "redoc";

import getStaticProps from "./get-static-props-swagger";

// eslint-disable-next-line max-len
const RedocApiDocument: (
    name: string,
    fallback?: ReactNode,
    swagger?: Exclude<RedocStandaloneProps, "spec">,
    // eslint-disable-next-line max-len,unicorn/no-useless-undefined
) => NextPage<InferGetStaticPropsType<typeof getStaticProps>> = (name, fallback = <div>loading...</div>, swagger = {}) => ({ swaggerUrl }: InferGetStaticPropsType<typeof getStaticProps>) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks,compat/compat
    const { data } = useQuery<object>(["swagger_file"], async () => fetch(swaggerUrl).then((response) => response.json()), { suspense: true });

    return (
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
                <Suspense fallback={fallback}>
                    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                    <RedocStandalone {...swagger} spec={data} />
                </Suspense>
            </>
    );
};

export default RedocApiDocument;
