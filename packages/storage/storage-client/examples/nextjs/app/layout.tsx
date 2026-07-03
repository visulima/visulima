import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
    description: "Example of @visulima/storage-client with Next.js",
    title: "Storage Client - Next.js Example",
};

export default function RootLayout(
    props: Readonly<{
        children: React.ReactNode;
    }>,
) {
    return (
        <html lang="en">
            <body>{props.children}</body>
        </html>
    );
}
