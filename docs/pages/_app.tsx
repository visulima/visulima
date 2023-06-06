import "../css/styles.css";
import "@visulima/nextra-theme-docs/component-style.css";

import type { AppProps } from "next/app";
import Head from "next/head";
import type { FC, ReactElement } from "react";
import React from "react";

// TODO: add accessibility report back if nextra version is updated
// import reportAccessibility from "../src/utils/report-accessibility";

const MyApp: FC<AppProps & { Component: AppProps["Component"] & { getLayout?: (component: ReactElement) => ReactElement } }> = ({ Component, pageProps }) => {
    const getLayout = Component.getLayout ?? ((page) => page);

    // eslint-disable-next-line react/jsx-props-no-spreading
    return (
        <>
            <Head>
                <link rel="preload" href="/Inter.var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
            </Head>
            {getLayout(<Component {...pageProps} />)}
        </>
    );
};

// reportAccessibility(React);

export default MyApp;
