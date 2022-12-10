import Document, {
 Head, Html, Main, NextScript,
} from "next/document";
import React from "react";

class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head />
                <body className="relative">
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
