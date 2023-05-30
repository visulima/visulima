import Document, { Head, Html, Main, NextScript } from "next/document";
import { SkipNavLink } from "@visulima/nextra-theme-docs";

class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head />
                <body>
                    <SkipNavLink styled />
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
