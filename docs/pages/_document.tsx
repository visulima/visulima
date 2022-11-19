import { SkipNavLink } from "@reach/skip-nav";
import Document, {
    Head, Html, Main, NextScript,
} from "next/document";
import React from "react";

class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head />
                <body className="relative bg-x-gradient-grey-200-grey-200-50-white-50">
                    <SkipNavLink />
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
