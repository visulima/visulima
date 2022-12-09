import "../css/styles.css";

import "@visulima/nextra-theme-docs/style.css";
import React from "react";
import type { AppProps } from "next/app";

import reportAccessibility from "../src/utils/report-accessibility";

function MyApp({ Component, pageProps }: AppProps & { Component: AppProps["Component"] & { getLayout?: Function } }) {
    const getLayout = Component.getLayout || ((page) => page);

    // eslint-disable-next-line react/jsx-props-no-spreading
    return getLayout(<Component {...pageProps} />);
}

reportAccessibility(React);

export default MyApp;
