import "../css/styles.css";

import type { AppProps } from "next/app";

function MyApp({ Component, pageProps }: AppProps & { Component: AppProps["Component"] & { getLayout?: Function } }) {
    const getLayout = Component.getLayout || ((page) => page);

    // eslint-disable-next-line react/jsx-props-no-spreading
    return getLayout(<Component {...pageProps} />);
}

export default MyApp;
