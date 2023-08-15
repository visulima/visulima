import { SkipNavLink } from "@visulima/nextra-theme-docs/components";
import Document, { Head, Html, Main, NextScript } from "next/document";
import type { ReactElement } from "react";
import React from "react";

class MyDocument extends Document {
    public render(): ReactElement {
        return (
            <Html lang="en">
                <Head />
                <body className="relative">
                    <SkipNavLink />
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
