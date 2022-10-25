import "../style.css";
import "nextra-theme-docs/style.css";

import type { AppProps } from "next/app";

function MyApp({ Component, pageProps }: AppProps) {
    const getLayout = Component.getLayout || ((page) => page);

    // eslint-disable-next-line react/jsx-props-no-spreading
    return getLayout(<Component {...pageProps} />);
}

export default MyApp;
