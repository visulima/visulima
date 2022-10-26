// eslint-disable-next-line import/no-extraneous-dependencies
import "swagger-ui-react/swagger-ui.css";
import "../styles/globals.css";

import type { AppProps } from "next/app";
import { Hydrate, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState, Suspense } from "react";

function MyApp({ Component, pageProps }: AppProps) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <Hydrate state={pageProps.dehydratedState}>
                <Suspense fallback="Loading...">
                    <Component {...pageProps} />
                </Suspense>
            </Hydrate>
        </QueryClientProvider>
    );
}

export default MyApp;
