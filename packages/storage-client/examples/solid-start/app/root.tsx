import "./app.css";

import { Links, Meta, Scripts, Title } from "@solidjs/start";
import { Suspense } from "solid-js";

export default function Root() {
    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <Meta />
                <Links />
                <Title>Storage Client - Solid Start Example</Title>
            </head>
            <body>
                <Suspense>
                    <div id="app" />
                </Suspense>
                <Scripts />
            </body>
        </html>
    );
}
