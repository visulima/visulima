import "../css/styles.css";
import "@visulima/nextra-theme-docs/style.css";

import type { AppProps } from "next/app";
import type { FC, ReactElement } from "react";
import React from "react";

const MyApp: FC<AppProps & { Component: AppProps["Component"] & { getLayout?: (component: ReactElement) => ReactElement } }> = ({ Component, pageProps }) => {
    const getLayout = Component.getLayout ?? ((page) => page);

    // eslint-disable-next-line react/jsx-props-no-spreading
    return getLayout(<Component {...pageProps} />);
};

export default MyApp;
