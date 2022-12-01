// eslint-disable-next-line import/no-extraneous-dependencies
import "swagger-ui-react/swagger-ui.css";
import "../styles/globals.css";

import type { AppProps } from "next/app";
import React, { useState, Suspense } from "react";

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <Suspense fallback="Loading...">
            <Component {...pageProps} />
        </Suspense>
    );
}

export default MyApp;
